/**
 * Converts an EmbedConfig into the flat string-keyed map the C++ addon expects.
 *
 * Extracted from the plugin so the advisory fit check can build its request
 * from the same transform the real embedding load uses.
 */
export function transformEmbedConfig(embedConfig) {
    const config = {
        device: embedConfig.device,
        gpu_layers: `${embedConfig.gpuLayers}`,
        batch_size: `${embedConfig.batchSize}`
    };
    if (embedConfig.poll !== undefined) {
        config.poll = `${embedConfig.poll}`;
    }
    if (embedConfig.pollBatch !== undefined) {
        config['poll-batch'] = `${embedConfig.pollBatch}`;
    }
    if (embedConfig.backend !== undefined) {
        config.backend = embedConfig.backend.join(',');
    }
    if (embedConfig.flashAttention) {
        config.flash_attn = embedConfig.flashAttention;
    }
    if (embedConfig.pooling) {
        config.pooling = embedConfig.pooling;
    }
    if (embedConfig.attention) {
        config.attention = embedConfig.attention;
    }
    if (typeof embedConfig.embdNormalize === 'number') {
        config.embd_normalize = `${embedConfig.embdNormalize}`;
    }
    if (embedConfig.mainGpu !== undefined) {
        config['main-gpu'] =
            typeof embedConfig.mainGpu === 'number' ? `${embedConfig.mainGpu}` : embedConfig.mainGpu;
    }
    if (embedConfig.splitMode) {
        config['split-mode'] = embedConfig.splitMode;
    }
    if (embedConfig.tensorSplit) {
        config['tensor-split'] = embedConfig.tensorSplit;
    }
    if (typeof embedConfig.verbosity === 'number') {
        config.verbosity = `${embedConfig.verbosity}`;
    }
    if (embedConfig.openclCacheDir) {
        config.openclCacheDir = embedConfig.openclCacheDir;
    }
    return config;
}
