import type { QvacChunk } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { FileKey, KnownFile, LocalFile } from '../local/files.ts';
export type FileChunk = Pick<QvacChunk, 'type' | 'chatId' | 'attachment'>;
export interface MeshFileIndex {
    record(chunks: ReadonlyArray<FileChunk>): Promise<void>;
    refresh(chunks: ReadonlyArray<FileChunk>): Promise<void>;
    read(reference: string): void;
    markCleared(blobId: string): Promise<void>;
    list(): Promise<LocalFile[]>;
    retireChats(purged: ReadonlyMap<string, number>): Promise<void>;
    forget(file: FileKey): Promise<void>;
}
export interface FileOwner {
    readonly meshKey: Buffer;
    readonly ownCoreKey: Buffer;
}
export declare function knownFile(chunk: FileChunk, owner: FileOwner): KnownFile | null;
export declare function referencedFile(reference: string, owner: FileOwner): KnownFile | null;
export declare function fileKeyOf(reference: string, { meshKey, ownCoreKey }: FileOwner): FileKey | null;
