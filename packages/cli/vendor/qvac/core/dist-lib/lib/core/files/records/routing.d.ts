import type { QvacChunkContentAttachment, QvacKnowledge } from '../../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../../mesh.ts';
import type { AttachmentFile } from '../../document-attachment.ts';
export declare function isKnowledgeRoutedAttachment(input: AttachmentFile): boolean;
export declare function routeAttachmentToKnowledge(mesh: Mesh, chatId: string, attachment: QvacChunkContentAttachment): Promise<QvacKnowledge>;
export declare function hasLiveSource(mesh: Mesh, chatId: string | null | undefined, reference: string): Promise<boolean>;
interface AttachTurnChunk {
    readonly id: string;
    readonly seq: number;
    readonly runId?: string | null;
    readonly type?: string | null;
    readonly attachment?: {
        readonly id?: string | null;
        readonly fileName?: string | null;
        readonly mimeType?: string | null;
        readonly deletedAt?: number | null;
    } | null;
    readonly userMessage?: unknown;
}
export declare function attachTurnDocumentIds(chunks: ReadonlyArray<AttachTurnChunk>): string[];
export {};
