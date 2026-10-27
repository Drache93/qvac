import { loadModelServerParamsSchema, normalizeModelType } from '../../schemas/index.js';
import { nowMs } from '../../profiling/clock.js';
import { forwardBackendDiagnostics } from '../../profiling/backend-diagnostics.js';
import { isModelLoaded, registerModel } from '../../runtime/model-registry.js';
import { startLogBuffering, stopLogBufferingWithTimeout } from '../../runtime/logging-stream-registry.js';
import { detectShardedModel, generateShardFilenames, validateShardedModelCache } from '../../utils/index.js';
import { PluginNotFoundError, ModelFileNotFoundError, ModelFileNotFoundInDirError, ModelFileLocateFailedError, ModelFitRefusedError, InferenceCancelledError } from '../../errors/index.js';
import { ensureAddonLoggerReady, getPlugin } from '../index.js';
import { runAdvisoryFitCheck } from '../../model-fit/load-check.js';
import { refusesLoad, resolveModelFitPolicy, runsProbe } from '../../schemas/model-fit-policy.js';
import { getConfig } from '../../runtime/state.js';
import { resolveToolDialect } from '../../utils/tools/dialect.js';
import { promises as fsPromises } from 'bare-fs';
import path from 'bare-path';
import { getEngineLogger } from '../../logging/index.js';
const logger = getEngineLogger();
export async function loadModel(params, options) {
    const { modelId, modelPath, options: modelOptions, artifacts, modelName } = loadModelServerParamsSchema.parse(params);
    const { modelConfig, modelType: rawModelType, modelFitPolicy } = modelOptions;
    // Normalize modelType to canonical form (handles aliases and custom types)
    const modelType = normalizeModelType(rawModelType);
    // Check if model is already loaded
    if (isModelLoaded(modelId)) {
        logger.info(`${modelType} model ${modelId} is already loaded`);
        return {};
    }
    // Detect if sharded model
    const modelFileName = path.basename(modelPath);
    const shardInfo = detectShardedModel(modelFileName);
    const isShardedModel = shardInfo.isSharded;
    const plugin = getPlugin(modelType);
    if (!plugin) {
        throw new PluginNotFoundError(modelType);
    }
    if (isShardedModel) {
        // For sharded models, validate all shards and tensors.txt exist
        const shardDir = path.dirname(modelPath);
        const isValid = await validateShardedModelCache(shardDir, modelFileName);
        if (!isValid) {
            const numberedShards = generateShardFilenames(modelFileName);
            throw new ModelFileNotFoundError(`Missing shards or ${shardInfo.baseFilename}.tensors.txt. Expected ${numberedShards.length} shard files + tensors.txt in ${shardDir}`);
        }
    }
    else if (!plugin.skipPrimaryModelPathValidation) {
        // For non-sharded models, validate single file exists
        try {
            const modelDir = path.dirname(modelPath);
            const modelFile = path.basename(modelPath);
            const files = (await fsPromises.readdir(modelDir));
            if (!files.includes(modelFile)) {
                throw new ModelFileNotFoundInDirError(modelFile, modelDir, modelType);
            }
        }
        catch (error) {
            logger.error(`Error reading ${modelType} model directory:`, error instanceof Error ? error.message : String(error));
            throw new ModelFileLocateFailedError(modelType, modelPath, error);
        }
    }
    // Runs after config resolution and path validation so it sees the same state
    // the real load uses, and before `createModel()` so it never competes with
    // the native load for device memory.
    const fitPolicy = resolveModelFitPolicy(modelFitPolicy, getConfig().modelFitPolicy);
    const request = options?.request;
    const fitProbe = runsProbe(fitPolicy)
        ? await runAdvisoryFitCheck({
            modelId,
            modelType: modelType,
            modelPath,
            modelConfig,
            artifacts,
            isShardedModel
        }, request !== undefined ? { signal: request.signal } : {})
        : undefined;
    if (request?.signal.aborted === true) {
        throw new InferenceCancelledError(request.requestId);
    }
    if (refusesLoad(fitPolicy, fitProbe?.verdict)) {
        throw new ModelFitRefusedError(modelType, fitProbe.reason, fitProbe.message);
    }
    // Load the addon's logger before the addon itself runs. Plugins that defer
    // their logging module do so to keep registration free of native loads, so
    // this is the first point their addon is genuinely required.
    await ensureAddonLoggerReady(plugin);
    logger.info(`${modelType}: Loading model ${modelId}...`);
    startLogBuffering(modelId);
    try {
        const initStart = options?.collectTiming ? nowMs() : 0;
        const result = plugin.createModel({
            modelId,
            modelPath,
            modelConfig: modelConfig,
            modelName,
            artifacts
        });
        await result.model.load(false);
        const modelInitializationTimeMs = options?.collectTiming ? nowMs() - initStart : undefined;
        logger.info(`${modelType} model ${modelId} loaded`);
        const toolDialect = 'completionStream' in plugin.handlers
            ? await resolveToolDialect(modelName, modelPath)
            : undefined;
        registerModel(modelId, {
            model: result.model,
            path: modelPath,
            config: modelConfig,
            modelType: modelType,
            name: modelName,
            fitProbe,
            toolDialect
        });
        const loadResult = modelInitializationTimeMs !== undefined ? { timing: { modelInitializationTimeMs } } : {};
        return forwardBackendDiagnostics(loadResult, result);
    }
    finally {
        stopLogBufferingWithTimeout(modelId);
    }
}
