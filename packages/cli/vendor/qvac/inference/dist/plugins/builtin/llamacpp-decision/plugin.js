import { LayaDecisions } from '@qvac/embed-llamacpp';
import { definePlugin, defineHandler, ModelType, ADDON_EMBEDDING, decisionConfigSchema, decideRequestSchema, decideResponseSchema } from '../../../schemas/index.js';
import { createStreamLogger, registerAddonLogger, getEngineLogger } from '../../../logging/index.js';
import { isMobile } from '../../../runtime/state.js';
import { stripMultiGpuKeys } from '../../../utils/multi-gpu-mobile.js';
import { getModelShardFiles } from '../../../utils/shard-utils.js';
import { decide } from './ops/decide.js';
import { transformDecisionConfig } from './helpers.js';
function createDecisionModel(params) {
    const config = { ...transformDecisionConfig(decisionConfigSchema.parse(params.modelConfig)) };
    if (isMobile()) {
        const stripped = stripMultiGpuKeys(config);
        if (stripped.length > 0) {
            getEngineLogger().warn(`[${ModelType.llamacppDecision}:${params.modelId}] Multi-GPU parameters (${stripped.join(', ')}) are not supported on mobile. Removing them from config; model will load with single-GPU defaults.`);
        }
    }
    const logger = createStreamLogger(params.modelId, ModelType.llamacppDecision);
    registerAddonLogger(params.modelId, ModelType.llamacppDecision, logger);
    return new LayaDecisions({
        files: { model: getModelShardFiles(params.modelPath) },
        config,
        logger
    });
}
export const decisionPlugin = definePlugin({
    modelType: ModelType.llamacppDecision,
    displayName: 'Decisions (llama.cpp)',
    addonPackage: ADDON_EMBEDDING,
    loadConfigSchema: decisionConfigSchema,
    createModel: (params) => ({ model: createDecisionModel(params) }),
    handlers: {
        decide: defineHandler({
            requestSchema: decideRequestSchema,
            responseSchema: decideResponseSchema,
            streaming: false,
            cancel: { scope: 'model', hard: true },
            handler: decide
        })
    },
    logging: {
        module: () => import('@qvac/embed-llamacpp/addonLogging'),
        namespace: ModelType.llamacppEmbedding
    }
});
