export interface LinkableAttachment {
    readonly blobId: string;
    readonly mimeType: string;
    readonly deletedAt?: number;
}
export type AttachmentUrl = (attachment: LinkableAttachment) => string | null;
export declare function linkAttachment<T extends LinkableAttachment>(mint: AttachmentUrl | null, attachment: T): T;
