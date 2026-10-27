export declare const STAGING_DIR: string;
export declare const STAGING_MAX_AGE_MS: number;
export declare function stageFile(prefix: string, bytes: Uint8Array): Promise<string>;
export declare function sweepStaging(now?: number): void;
