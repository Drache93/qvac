export declare const REPLY_MESSAGE_PREFIX = "reply-";
export declare function replyMessageId(runId: string): string;
interface LinkableChunk {
    readonly id: string;
    readonly runId?: string | null;
    readonly seq: number;
    readonly attachment?: unknown;
    readonly userMessage?: unknown;
}
export declare function groupAttachmentsByMessage<T extends LinkableChunk>(attachments: ReadonlyArray<T>, userMessages: ReadonlyArray<T>): Map<string, T[]>;
export {};
