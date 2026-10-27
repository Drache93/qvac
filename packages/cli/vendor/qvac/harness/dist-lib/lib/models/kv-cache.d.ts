export interface KvCacheTypes {
    k: string | undefined;
    v: string | undefined;
}
export declare function adrenoSafeKvCache(device: 'cpu' | 'gpu' | undefined, { k, v }: KvCacheTypes, hostPlatform?: string): KvCacheTypes;
