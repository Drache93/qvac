import type { SdcppConfig } from '../../../schemas/index.js';
export declare function flattenUpscalerKeys(upscaler: SdcppConfig['upscaler']): {
    upscaler_threads?: number;
    upscaler_offload_params_to_cpu?: boolean;
    upscaler_direct?: boolean;
    upscaler_tile_size?: number;
};
export declare function toEsrganAddonConfig(config: SdcppConfig): {
    verbosity?: number;
    device?: "cpu" | "gpu";
    upscaler_threads?: number;
    upscaler_offload_params_to_cpu?: boolean;
    upscaler_direct?: boolean;
    upscaler_tile_size?: number;
};
