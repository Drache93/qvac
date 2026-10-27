export declare function logCacheStatus(cacheKey: string, isReusing: boolean): void;
export declare function logMessagesToAddon(messages: unknown[], phase?: 'PROMPT_SEND' | 'NO_CACHE'): void;
export declare function logCacheDisabled(): void;
export declare function logCacheSave(sessionPath: string): void;
export declare function logCacheSaveError(sessionPath: string, err: unknown): void;
