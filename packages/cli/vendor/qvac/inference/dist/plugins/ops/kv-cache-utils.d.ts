import { type CacheMessage } from '../../utils/index.js';
import type { Tool } from '../../schemas/tools.js';
export declare function extractSystemPrompt(messages: CacheMessage[]): string | null;
export declare function generateConfigHash(systemPrompt: string | null): string;
export declare function generateCacheKey(messages: CacheMessage[], tools?: readonly Tool[]): string;
export declare function getCacheFilePath(modelId: string, configHash: string, cacheKey: string): Promise<string>;
export declare function findMatchingCache(modelId: string, configHash: string, currentHistory: CacheMessage[], tools?: readonly Tool[]): Promise<{
    cacheKey: string;
    cachePath: string;
} | null>;
export declare function getCurrentCacheInfo(modelId: string, configHash: string, currentHistory: CacheMessage[], tools?: readonly Tool[]): Promise<{
    cacheKey: string;
    cachePath: string;
}>;
export declare function renameCacheFile(oldPath: string, newPath: string): Promise<boolean>;
export declare function pruneEmptyCacheDirectories(cacheFilePath: string, activePaths?: readonly string[]): Promise<void>;
export declare function deleteCache(options: {
    all: true;
} | {
    kvCacheKey: string;
    modelId?: string;
}): Promise<string>;
