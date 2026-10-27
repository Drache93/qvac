import type HyperDB from 'hyperdb';
import type { QvacChunk } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface MeshCopy {
    readonly from: Mesh;
    readonly into: Mesh;
}
export interface ChatMoveCopy extends MeshCopy {
    readonly chatId: string;
    readonly originDeviceId: Buffer;
    readonly references: Map<string, string>;
}
export declare function copyChunks(snap: HyperDB, chatId: string, { from, into }: MeshCopy): Promise<void>;
export interface MovedChunks {
    readonly copied: number;
    readonly open: ReadonlySet<string>;
    readonly withheld: number;
}
export declare function copyMovedChunks(snap: HyperDB, chatId: string, copy: ChatMoveCopy): Promise<MovedChunks>;
export declare function sentBy(chunk: QvacChunk): Buffer | undefined;
export declare function copyMovedKnowledge(snap: HyperDB, chatId: string, copy: ChatMoveCopy): Promise<void>;
export declare function movedBlob({ from, into, references }: ChatMoveCopy, { blobId }: BlobHolder): Promise<string>;
export declare function removedReference({ mimeType }: TypedFile): string;
interface TypedFile {
    readonly mimeType: string;
}
interface BlobHolder {
    readonly blobId: string;
}
export declare function chunksOf(snap: HyperDB, chatId: string): Promise<QvacChunk[]>;
export declare function copyBlob(from: Mesh, into: Mesh, reference: string): Promise<string | null>;
export declare function stripped<T extends {
    version?: number;
}>(row: T): Omit<T, 'version'>;
export interface ContentCopy extends MeshCopy {
    readonly deviceId: Buffer;
    readonly chats?: ReadonlySet<string>;
    readonly unlinkProjects?: boolean;
}
export declare function copyContent(copy: ContentCopy): Promise<void>;
export declare const UPGRADED_RUN_REASON = "the app was updated before this was answered, send it again";
export {};
