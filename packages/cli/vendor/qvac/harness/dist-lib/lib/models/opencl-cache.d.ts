export declare const OPENCL_CACHE_MAX_AGE_MS: number;
export declare function openclEngineKey(sdkVersion?: string): string;
export declare function openclCacheRoot(env?: Record<string, string | undefined>, hostPlatform?: string): string | undefined;
export declare function openclCacheDir(env?: Record<string, string | undefined>, hostPlatform?: string, sdkVersion?: string): string | undefined;
export interface PrepareOpenclCacheOptions {
    hostPlatform?: string;
    sdkVersion?: string | undefined;
    now?: number;
}
export declare function prepareOpenclCache(env?: Record<string, string | undefined>, { hostPlatform, sdkVersion, now }?: PrepareOpenclCacheOptions): void;
