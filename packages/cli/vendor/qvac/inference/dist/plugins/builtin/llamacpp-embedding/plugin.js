import EmbedLlamacpp, { assessFit as embedAssessFit } from '@qvac/embed-llamacpp';
import { definePlugin, defineHandler, embedRequestSchema, embedResponseSchema, ModelType, embedConfigBaseSchema, ADDON_EMBEDDING } from '../../../schemas/index.js';
import { createStreamLogger, registerAddonLogger, getEngineLogger } from '../../../logging/index.js';
import { getFirstShardPath } from '../../../utils/index.js';
import { embed } from '../../ops/embed.js';
import { forwardModelExecution } from '../../../profiling/model-execution.js';
import { isMobile } from '../../../runtime/state.js';
import { stripMultiGpuKeys } from '../../../utils/multi-gpu-mobile.js';
import { transformEmbedConfig } from './transform.js';
import { getIdMapIndex } from './turbovec.cjs';
const turbovecIndexProvider = {
    create(options) {
        const IdMapIndex = getIdMapIndex();
        return new IdMapIndex(options);
    },
    load(snapshotPath) {
        return getIdMapIndex().load(snapshotPath);
    }
};
function createEmbeddingsModel(modelId, modelPath, embedConfig) {
    const logger = createStreamLogger(modelId, ModelType.llamacppEmbedding);
    registerAddonLogger(modelId, ModelType.llamacppEmbedding, logger);
    const config = transformEmbedConfig(embedConfig);
    if (isMobile()) {
        const stripped = stripMultiGpuKeys(config);
        if (stripped.length > 0) {
            getEngineLogger().warn(`[${ModelType.llamacppEmbedding}:${modelId}] Multi-GPU parameters (${stripped.join(', ')}) are not supported on mobile (single-GPU device) — removing from config; model will load with single-GPU defaults`);
        }
    }
    const model = new EmbedLlamacpp({
        files: { model: [getFirstShardPath(modelPath)] },
        config,
        logger,
        opts: { stats: true }
    });
    return { model };
}
export const embeddingsPlugin = definePlugin({
    modelType: ModelType.llamacppEmbedding,
    displayName: 'Embeddings (llama.cpp)',
    addonPackage: ADDON_EMBEDDING,
    loadConfigSchema: embedConfigBaseSchema,
    assessFit: embedAssessFit,
    createModel(params) {
        const embedConfig = (params.modelConfig ?? {});
        const { model } = createEmbeddingsModel(params.modelId, params.modelPath, embedConfig);
        return { model };
    },
    handlers: {
        embed: defineHandler({
            requestSchema: embedRequestSchema,
            responseSchema: embedResponseSchema,
            streaming: false,
            // Model-wide hard cancel via `addon.cancel()` on the llama.cpp
            // embedding addon. Compute is interrupted when fired.
            cancel: { scope: 'model', hard: true },
            handler: async function (request) {
                const embedResult = await embed({
                    modelId: request.modelId,
                    text: request.text
                }, request.requestId);
                return forwardModelExecution({
                    type: 'embed',
                    success: true,
                    embedding: embedResult.embedding,
                    ...(embedResult.stats && { stats: embedResult.stats })
                }, embedResult);
            }
        })
    },
    capabilities: {
        turbovecIndexProvider
    },
    logging: {
        module: () => import('@qvac/embed-llamacpp/addonLogging'),
        namespace: ModelType.llamacppEmbedding
    }
});
