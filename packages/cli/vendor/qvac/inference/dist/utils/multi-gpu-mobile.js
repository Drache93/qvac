export const MULTI_GPU_KEYS = ['main-gpu', 'split-mode', 'tensor-split'];
// Deletes unsupported mobile multi-GPU keys in place and returns the removed keys.
// RPC loads can retain split settings, but main-gpu is always unsupported.
// gpu_layers controls single-GPU offload and is left unchanged.
export function stripMultiGpuKeys(config, preserveRpcSplits = false) {
    const keepSplits = preserveRpcSplits &&
        typeof config['rpc-servers'] === 'string' &&
        config['rpc-servers'].trim().length > 0;
    const stripped = MULTI_GPU_KEYS.filter((k) => k in config && (!keepSplits || k === 'main-gpu'));
    stripped.forEach((k) => delete config[k]);
    return stripped;
}
