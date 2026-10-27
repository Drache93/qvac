import type { LoggerInterface } from '@qvac/logging';
import { type BlobStore } from '../store/index.ts';
import { type AbortSignal } from 'bare-abort-controller';
import type { FileRetries } from './state.ts';
export type SourceRead = {
    kind: 'bytes';
    bytes: Buffer;
} | {
    kind: 'missing';
    retryAt: number;
} | {
    kind: 'malformed';
};
export interface IndexingSourceOptions {
    readonly log: LoggerInterface | null;
    readonly retryMs?: number;
    readonly retries: FileRetries;
    readonly download?: {
        fetch: BlobStore['download'];
        ready: (id: string) => void;
    };
}
export declare class IndexingSource {
    private readonly _readBytes;
    private readonly _log;
    private readonly _retryMs;
    private readonly _download;
    private readonly _downloads;
    readonly retry: FileRetries;
    constructor(readBytes: BlobStore['readBytes'], opts: IndexingSourceOptions);
    retryBlockedUntil(id: string, now: number): number | null;
    retryMiss(id: string, now: number): number;
    retryClear(id: string): void;
    reconnect(onRetry?: (id: string, deadline: number) => void): number | null;
    read(id: string, blobRef: string, signal?: AbortSignal): Promise<SourceRead>;
    cancel(matches?: (id: string) => boolean): Promise<void>;
    pending(matches: (id: string) => boolean): boolean;
    private _fetch;
}
