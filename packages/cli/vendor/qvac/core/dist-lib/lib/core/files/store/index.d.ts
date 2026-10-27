import EventEmitter from 'bare-events';
import type Hyperblobs from 'hyperblobs';
import { stringifyBlobId, writeBlob, type BlobHost } from './blob.ts';
import { readBlobReference, readBlobReferenceBytes, downloadBlobReference } from './reference.ts';
export { CoreBlobServer } from './server.ts';
export type { MeshBlobKeys, MeshForBlobCore } from './server.ts';
export { compareBlobReferences, isInvalidBlobReferenceError, isPendingBlobReference, parseBlobReference, parseBlobReferenceCoreKey } from './reference.ts';
export { PENDING_BLOB_REFERENCE } from './reference.ts';
export type { BlobReferenceReadOptions } from './reference.ts';
export type { WriteProgress } from './blob.ts';
export { MAX_INLINE_BYTES, MAX_REFERENCE_CHARS } from './inline.ts';
export declare class BlobStore extends EventEmitter {
    readonly blobs: Hyperblobs;
    readonly log: BlobHost['log'];
    readonly openBlobs: BlobHost['openBlobs'];
    private readonly _readers;
    private readonly _updated;
    private _closed;
    constructor(host: BlobHost);
    write(chunks: AsyncIterable<Uint8Array>, options?: Parameters<typeof writeBlob>[2]): AsyncGenerator<import("./blob.ts").WriteProgress, any, any>;
    put(bytes: Buffer): Promise<{
        blobRef: import("hyperblobs").BlobId;
        reference: string;
    }>;
    reference(id: Parameters<typeof stringifyBlobId>[1]): string;
    inline(bytes: Buffer, mimeType: string): string;
    read(reference: string, options?: Parameters<typeof readBlobReference>[2]): AsyncGenerator<import("./blob.ts").BlobReadChunk, any, any>;
    readBytes(reference: string, options?: Parameters<typeof readBlobReferenceBytes>[2]): Promise<Buffer<ArrayBufferLike>>;
    download(reference: string, options: Parameters<typeof downloadBlobReference>[2]): Promise<void>;
    clear(reference: string, id: string): Promise<boolean>;
    compact(coreKeys: ReadonlyArray<Buffer>): Promise<void>;
    available(reference: string): Promise<boolean>;
    sweep(references: string[], coreLength: number): Promise<void>;
    close(): Promise<void>;
}
