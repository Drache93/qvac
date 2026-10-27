export interface DocumentAttachment {
    id: string;
    fileName: string;
    mimeType: string;
}
export interface AttachmentFile {
    readonly fileName: string;
    readonly mimeType: string;
}
export declare function isDocumentAttachment(ref: AttachmentFile): boolean;
interface NamedFile {
    readonly fileName: string;
    readonly mimeType: string;
}
export declare function isPdfAttachment(ref: NamedFile): boolean;
export declare function documentAttachmentLine(doc: DocumentAttachment): string;
export declare const DOCUMENT_ATTACHMENT_ONLY_PROMPT = "The user sent one or more documents without any accompanying text, and no excerpts of them are available. Say what each file is and ask what they would like done with it.";
export type DocumentUnreadReason = 'indexing' | 'knowledge-off' | 'unreadable';
export interface DocumentReadState {
    readonly knowledgeOn: boolean;
    readonly failedFiles: ReadonlyArray<string> | null | undefined;
    readonly attachedCount: number;
}
export declare function documentUnreadReason({ knowledgeOn, failedFiles, attachedCount }: DocumentReadState): DocumentUnreadReason;
export declare function documentUnreadNotice(reason: DocumentUnreadReason, plural: boolean): string;
export interface PdfPagesCutState {
    readonly fileName: string;
    readonly lastPage: number;
    readonly pageCount: number;
}
export declare function pdfPagesCutNotice({ fileName, lastPage, pageCount }: PdfPagesCutState): string;
export declare function pdfPagesSkippedNotice(fileName: string): string;
export interface AnnotatedMessage {
    content: string;
    documents?: DocumentAttachment[];
}
export declare function annotateDocumentAttachments(messages: AnnotatedMessage[]): void;
export {};
