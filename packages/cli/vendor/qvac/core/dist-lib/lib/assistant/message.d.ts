import type { DocumentAttachment } from '../core/document-attachment.ts';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    sender?: string;
    sentAt?: number;
    sentContent?: string;
    readContent?: string;
    attachments?: {
        path: string;
    }[];
    images?: AttachmentRef[];
    audioAttachments?: AttachmentRef[];
    videos?: VideoRef[];
    documents?: DocumentAttachment[];
    pdfs?: AttachmentRef[];
}
export declare const IMAGE_ONLY_USER_PROMPT = "The user sent one or more images without any accompanying text. Describe what the images show and respond to anything notable in them.";
export declare const DOCUMENT_ONLY_USER_PROMPT = "The user sent one or more documents without any accompanying text. Summarize the attached documents.";
export declare const IMAGE_AND_DOCUMENT_USER_PROMPT = "The user sent one or more images together with one or more documents, and no accompanying text. Describe what the images show and summarize the attached documents.";
export declare function backfillDocumentOnlyTurn(messages: ChatMessage[]): void;
export declare function backfillImageOnlyTurns(messages: ChatMessage[]): void;
export declare function unreadableImagesNotice(fileNames: readonly string[]): string;
export declare function annotateUnreadableImages(unreadable: ReadonlyMap<ChatMessage, string[]>): void;
export interface UnheardAudioNoticeOptions {
    readonly retryable?: boolean;
}
export declare function unheardAudioNotice(label: string, reason: string, opts?: UnheardAudioNoticeOptions): string;
export declare function silentAudioNotice(fileName: string): string;
export declare function audioTranscriptBlock(fileName: string, transcript: string): string;
export interface VideoFrames {
    readonly fileName: string;
    readonly duration: number;
    readonly times: ReadonlyArray<number>;
}
export declare function videoAnnotation({ fileName, duration, times }: VideoFrames): string;
export declare function videoTranscriptBlock(transcript: string): string;
export declare function unsyncedVideoNotice(fileName: string): string;
export declare function unreadVideoNotice(fileName: string): string;
export declare function hiddenVideoNotice(fileName: string): string;
export declare const VIDEO_NO_AUDIO = "[The video has no audio track.]";
export declare const VIDEO_SILENT = "[The video's audio contained no detectable speech.]";
export interface AttachmentRef {
    id: string;
    fileName: string;
    mimeType: string;
    blobId: string;
    url?: string | null;
}
export interface VideoRef extends AttachmentRef {
    digest?: AttachmentRef;
}
export interface AttachInput {
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
    raw?: boolean;
}
export interface AttachmentMeta {
    id: string;
    fileName: string;
    mimeType: string;
    byteLength: number;
}
export interface FetchedAttachment extends AttachmentMeta {
    bytes: Uint8Array;
}
export declare function restoreSentContent(messages: ChatMessage[]): void;
export declare function askedIn(sent: ReadonlyArray<ChatMessage>, sender: string | undefined): string | undefined;
export declare function nameSenders(messages: ReadonlyArray<ChatMessage>): ChatMessage[];
