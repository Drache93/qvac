const TINY_MODEL_PARAMS_BILLIONS = 0.8;
const TINY_MODEL_CONTEXT_SIZE = 8_192;
const DESKTOP_DEFAULT_CONTEXT_SIZE = 51_200;
export function defaultContextSize(modelSrc, trainedContext) {
    const size = tieredContextSize(modelSrc);
    return trainedContext ? Math.min(size, trainedContext) : size;
}
function tieredContextSize(modelSrc) {
    if (typeof modelSrc === 'string')
        return DESKTOP_DEFAULT_CONTEXT_SIZE;
    const params = Number.parseFloat(modelSrc.params);
    if (Number.isFinite(params) && params <= TINY_MODEL_PARAMS_BILLIONS) {
        return TINY_MODEL_CONTEXT_SIZE;
    }
    return DESKTOP_DEFAULT_CONTEXT_SIZE;
}
