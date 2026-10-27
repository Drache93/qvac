import type { DownloadHooks } from '../handlers/load-model/types.js';
export declare function calculateFileChecksum(filePath: string): Promise<string>;
/** Reuse a digest only while the file's identity and change metadata match. */
export declare function calculateCachedFileChecksum(filePath: string): Promise<string>;
export declare function measureChecksum(filePath: string, hooks?: DownloadHooks): Promise<string>;
