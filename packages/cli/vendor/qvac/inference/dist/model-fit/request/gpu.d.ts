/**
 * For loads where a layer count only applies once the GPU is switched on, and
 * for those that offer no layer count at all.
 */
export declare function gpuLayersFromGate(useGpu: boolean | undefined, layers?: number): number;
/**
 * For loads where an explicit layer count takes effect on its own and wins over
 * the boolean, which the schema requires to agree with it when both are set.
 */
export declare function gpuLayersFromCount(useGpu: boolean | undefined, layers?: number): number;
