import type Corestore from 'corestore';
import ReadyResource from 'ready-resource';
import type { LinkableAttachment } from '../../attachment-link.ts';
import type Hyperblobs from 'hyperblobs';
export interface MeshBlobKeys {
    key: Buffer;
    blobs: Hyperblobs;
    encryptionKey: Buffer;
}
export type MeshForBlobCore = (coreKey: string, blockOffset: number | undefined, meshKey: Buffer | undefined) => MeshBlobKeys | null | Promise<MeshBlobKeys | null>;
export type BlobRead = (mesh: MeshBlobKeys, coreKey: Buffer, blockOffset: number) => void;
export interface CoreBlobServerOptions {
    readonly readTimeoutMs?: number;
    readonly onRead?: BlobRead | null;
}
export declare class CoreBlobServer extends ReadyResource {
    private readonly _store;
    private readonly _mesh;
    private readonly _server;
    private readonly _probes;
    private readonly _readTimeoutMs;
    private readonly _onRead;
    private _suspended;
    constructor(store: Corestore, mesh: MeshForBlobCore, { readTimeoutMs, onRead }?: CoreBlobServerOptions);
    get port(): number;
    link({ blobId, mimeType }: LinkableAttachment, source: MeshBlobKeys): string | null;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    _open(): Promise<void>;
    _close(): Promise<void>;
    private _resolve;
    private _parse;
}
