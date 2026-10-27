import { defaultContextForModel, MOBILE_CONTEXT_SIZE, MODEL_CONTEXT_TARGET, modelContextTargetForPlatform } from '../model-context.js';
export function effectiveCtxSize(agent, opts) {
    const { appCtxSize, platform, custom } = opts;
    const configured = agent?.ctxSize || appCtxSize;
    if (configured) {
        return configured;
    }
    if (modelContextTargetForPlatform(platform) === MODEL_CONTEXT_TARGET.mobile) {
        return MOBILE_CONTEXT_SIZE;
    }
    return defaultContextForModel(agent?.modelName ?? '', MODEL_CONTEXT_TARGET.desktop, { custom });
}
