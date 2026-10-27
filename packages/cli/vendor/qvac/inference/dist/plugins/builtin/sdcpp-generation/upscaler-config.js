export function flattenUpscalerKeys(upscaler) {
    if (!upscaler)
        return {};
    return {
        ...(upscaler.tile_size !== undefined && { upscaler_tile_size: upscaler.tile_size }),
        ...(upscaler.direct !== undefined && { upscaler_direct: upscaler.direct }),
        ...(upscaler.offload_params_to_cpu !== undefined && {
            upscaler_offload_params_to_cpu: upscaler.offload_params_to_cpu
        }),
        ...(upscaler.threads !== undefined && { upscaler_threads: upscaler.threads })
    };
}
export function toEsrganAddonConfig(config) {
    return {
        ...flattenUpscalerKeys(config.upscaler),
        ...(config.device !== undefined && { device: config.device }),
        ...(config.verbosity !== undefined && { verbosity: config.verbosity })
    };
}
