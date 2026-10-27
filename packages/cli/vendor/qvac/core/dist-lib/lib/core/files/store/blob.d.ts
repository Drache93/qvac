import type { BlobId } from 'hyperblobs';
import type Hyperblobs from 'hyperblobs';
import type { AbortSignal } from 'bare-abort-controller';
import { type NextFrameOptions } from '../../next-frame.ts';
import type { LoggerInterface } from '@qvac/logging';
export interface BlobHost {
    readonly blobs: Hyperblobs;
    readonly log: LoggerInterface | null;
    openBlobs(key: Buffer): Promise<Hyperblobs>;
}
export type WriteProgress = {
    bytesWritten: number;
} | {
    bytesWritten: number;
    blobId: BlobId;
    byteLength: number;
};
export declare function writeBlob(blobs: Hyperblobs, chunks: AsyncIterable<Uint8Array>, options?: NextFrameOptions): AsyncGenerator<WriteProgress>;
export declare function stringifyBlobId(blobs: Hyperblobs, id: BlobId): string;
export interface ReadBlobOptions {
    readonly wait?: boolean;
    readonly timeout?: number;
    readonly signal?: AbortSignal;
}
export interface BlobReadChunk {
    readonly data: Buffer;
    readonly bytesRead: number;
    readonly byteLength: number;
}
export declare function readBlob(blobs: Hyperblobs, blobId: BlobId, options?: ReadBlobOptions): AsyncGenerator<BlobReadChunk>;
export declare function clearBlob(mesh: BlobHost, blobId: string, id: string): Promise<boolean>;
export declare function compactBlobCores(mesh: BlobHost, coreKeys: ReadonlyArray<Buffer>): Promise<void>;
