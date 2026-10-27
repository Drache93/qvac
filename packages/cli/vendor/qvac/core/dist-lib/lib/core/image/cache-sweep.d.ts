export declare const IMAGE_CACHE_MAX_BYTES: number;
export declare const IMAGE_CACHE_MAX_AGE_MS: number;
export interface CachedImage {
    readonly blobId: string;
    readonly fileName: string;
}
export declare function imageCacheName(image: CachedImage): string;
export declare function imageCacheKey(blobId: string): string;
export interface SweepImageCacheOptions {
    readonly maxBytes?: number;
    readonly maxAgeMs?: number;
    readonly keep?: ReadonlySet<string>;
    readonly inUse?: (name: string) => boolean;
}
export declare function sweepImageCache(dir: string, { maxBytes, maxAgeMs, keep, inUse }?: SweepImageCacheOptions): Promise<void>;
