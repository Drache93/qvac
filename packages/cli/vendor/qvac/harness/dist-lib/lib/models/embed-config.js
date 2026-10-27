export const DEFAULT_EMBED_BATCH_SIZE = 1024;
export function createEmbedConfig(input = {}) {
    assertOptionalEmbedDevice(input.device);
    assertNonNegativeInteger('embedGpuLayers', input.gpuLayers);
    assertPositiveInteger('embedBatchSize', input.batchSize);
    return {
        device: input.device ?? 'gpu',
        gpuLayers: input.gpuLayers,
        batchSize: input.batchSize ?? DEFAULT_EMBED_BATCH_SIZE
    };
}
export function assertEmbedDevice(device) {
    if (device === 'gpu' || device === 'cpu')
        return;
    throw new TypeError('embedDevice must be "gpu" or "cpu"');
}
function assertOptionalEmbedDevice(device) {
    if (device === undefined)
        return;
    assertEmbedDevice(device);
}
function assertNonNegativeInteger(name, value) {
    if (value === undefined || (Number.isInteger(value) && value >= 0))
        return;
    throw new TypeError(`${name} must be a non-negative integer`);
}
function assertPositiveInteger(name, value) {
    if (value === undefined || (Number.isInteger(value) && value > 0))
        return;
    throw new TypeError(`${name} must be a positive integer`);
}
