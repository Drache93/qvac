export type KvCacheDeletionResult = {
    status: 'success';
} | {
    status: 'failure';
    error: string;
} | {
    status: 'unsupported';
    error: string;
};
type KvCacheSdk = Pick<typeof import('@qvac/inference'), 'deleteCache'>;
export declare function deleteAllKvCaches(loadSdk: () => Promise<KvCacheSdk>): Promise<KvCacheDeletionResult>;
export declare function deleteKvCacheKey(loadSdk: () => Promise<KvCacheSdk>, kvCacheKey: string): Promise<KvCacheDeletionResult>;
export declare function unsupportedKvCacheDeletion(error?: string): KvCacheDeletionResult;
export {};
