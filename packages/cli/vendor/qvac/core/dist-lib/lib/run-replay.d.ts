import type { ChatMessage } from './assistant/message.ts';
export declare const LOCAL_HOLDER = "local";
export interface ReplayChat {
    readonly holder: string;
    readonly chatId: string;
}
export interface SentRun {
    readonly messages: ChatMessage[];
    readonly asked?: string | undefined;
}
export declare class RunReplayStore {
    private readonly _dir;
    constructor(dir: string);
    started(): Promise<boolean>;
    start(): Promise<void>;
    load(chat: ReplayChat): Promise<Map<string, ChatMessage[]>>;
    loadAsked(chat: ReplayChat): Promise<Map<string, string>>;
    save({ holder, chatId }: ReplayChat, runId: string, { messages, asked }: SentRun): Promise<void>;
    private _records;
    forget(chatId: string, holder?: string): Promise<void>;
    clear(holder: string): Promise<void>;
    private _chatDir;
    private _holders;
}
export interface SentRunTracker {
    readonly used: boolean;
    observe(call: Record<string, unknown>): void;
    turns(inputLength: number): ChatMessage[] | null;
}
export declare function trackSentRun(cacheKey: string | undefined): SentRunTracker;
export declare function appendedTurns(sent: unknown, inputLength: number): ChatMessage[] | null;
export declare function isChatMessage(value: unknown): value is ChatMessage;
