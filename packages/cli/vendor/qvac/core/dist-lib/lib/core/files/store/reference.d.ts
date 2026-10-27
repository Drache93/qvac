import type { BlobId } from 'hyperblobs';
import { type BlobHost, type BlobReadChunk } from './blob.ts';
import type { AbortSignal } from 'bare-abort-controller';
import { type InlinePayload } from './inline.ts';
import { PENDING_BLOB_REFERENCE } from '../../../constants.ts';
export interface ParsedBlobReference {
    readonly blobId: BlobId;
    readonly coreKey?: string;
    readonly inline?: InlinePayload;
}
export interface BlobReferenceReadOptions {
    readonly remoteTimeoutMs?: number;
    readonly wait?: boolean;
    readonly signal?: AbortSignal;
}
export { PENDING_BLOB_REFERENCE };
export declare function isPendingBlobReference(blobReference: string): boolean;
export declare function isInvalidBlobReferenceError(error: unknown): error is TypeError;
export declare function parseBlobReferenceCoreKey(blobReference: string): string | undefined;
export declare function parseBlobReference(blobReference: string): ParsedBlobReference;
export declare function compareBlobReferences(left: string, right: string, localCoreKey?: string): boolean | null;
export declare function readBlobReference(mesh: BlobHost, blobReference: string, options?: BlobReferenceReadOptions): AsyncGenerator<BlobReadChunk>;
export interface DownloadBlobReferenceOptions {
    readonly signal: AbortSignal;
}
export declare function downloadBlobReference(mesh: BlobHost, reference: string, { signal }: DownloadBlobReferenceOptions): Promise<void>;
export declare function readBlobReferenceBytes(mesh: BlobHost, blobReference: string, options?: BlobReferenceReadOptions): Promise<Buffer>;
