import type { AssistantUploadAttachmentRequest } from '../../../spec/hyperschema/types.d.ts';
import type { HandlerFrames } from '../../../spec/capabilities.d.ts';
import type { QvacChunkContentAttachment, QvacKnowledge } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../mesh.ts';
export type UploadFrame = {
    readonly bytesWritten: number;
    readonly attachment?: undefined;
    readonly knowledge?: undefined;
} | {
    readonly bytesWritten: number;
    readonly attachment: QvacChunkContentAttachment;
    readonly knowledge: QvacKnowledge | undefined;
} | {
    readonly bytesWritten: number;
    readonly attachment?: undefined;
    readonly knowledge: QvacKnowledge;
};
export interface FileHandlersOptions {
    readonly maxBytes?: number;
    readonly deviceId?: Buffer | null;
    readonly inactivityMs?: number;
}
export interface UploadFileOptions extends FileHandlersOptions {
    readonly kind: 'attachment' | 'knowledge';
    readonly maxBytes: number;
}
export interface UploadProgress {
    readonly bytesWritten: number;
}
export declare function uploadFile(mesh: Mesh, frames: AsyncIterable<AssistantUploadAttachmentRequest> | HandlerFrames<AssistantUploadAttachmentRequest>, { kind, maxBytes, deviceId, inactivityMs }: UploadFileOptions): AsyncGenerator<UploadFrame>;
export declare function capped(chunks: AsyncIterable<Buffer>, maxBytes: number, tooLarge: () => Error): AsyncGenerator<Buffer>;
export declare function dataFrames<T extends {
    data?: Buffer | null;
}>(rest: AsyncIterator<T>, firstData: Buffer | null | undefined): AsyncGenerator<Buffer>;
export interface PeekedHead {
    readonly head: Buffer;
    readonly rest: AsyncIterable<Buffer>;
}
export declare function peekHead(it: AsyncIterable<Buffer>, n: number): Promise<PeekedHead>;
