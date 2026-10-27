export function transformRerankConfig(config) {
    const { pollBatch, backend, ...nativeConfig } = config;
    const transformed = {
        ...Object.fromEntries(Object.entries(nativeConfig)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)])),
        device: config.device
    };
    if (pollBatch !== undefined) {
        transformed['poll-batch'] = `${pollBatch}`;
    }
    if (backend !== undefined) {
        transformed.backend = backend.join(',');
    }
    return transformed;
}
