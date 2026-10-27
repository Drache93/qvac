import type { WorldConfig } from '@qvac/diffusion-cpp/world';
import type { SdcppConfig } from '../../../schemas/index.js';
export declare const DEFAULT_WORLD_FIT_STEPS = 100;
/** `fitSteps` sizes the memory fit only; the native walk session never sees it. */
export declare function splitWorldConfig(world: SdcppConfig['world']): {
    fitSteps: number;
    session: WorldConfig;
};
