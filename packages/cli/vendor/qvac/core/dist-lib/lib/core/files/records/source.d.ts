import type HyperDB from 'hyperdb';
import type { QvacChunk, QvacKnowledge } from '../../../../spec/mesh/hyperschema/types.d.ts';
export type FileInput = 'knowledge' | 'attachment';
export type FileRecord = QvacKnowledge & {
    kind: FileInput;
    originDeviceId?: Buffer | null;
    preview?: boolean;
};
export declare function attachmentRecord(chunk: QvacChunk): FileRecord | null;
export declare function fileRecord(view: HyperDB, id: string, input: FileInput): Promise<FileRecord | null>;
export declare function fileIds(view: HyperDB, input: FileInput, mediaKind?: string): Promise<string[]>;
export declare function claimSource(view: HyperDB, id: string): Promise<FileRecord | null>;
export interface ChatFileKey {
    readonly chatId: string;
    readonly fileId: string;
}
export declare function scopedFile(view: HyperDB, { chatId, fileId }: ChatFileKey): Promise<FileRecord | null>;
