export interface InferenceCallEntry {
    runId: string;
    at: number;
    call: Record<string, unknown>;
}
export interface InferenceCallSent {
    readonly runId: string;
    readonly round: number;
    readonly messages: unknown;
    readonly tokens: unknown;
    readonly outcome: unknown;
    readonly reason: unknown;
}
export interface InferenceCallOutcome {
    readonly runId: string;
    readonly outcome: string;
    readonly reason: string | null;
}
export interface InferenceCallPage {
    readonly calls: ReadonlyArray<InferenceCallEntry>;
    readonly truncated: boolean;
}
export interface SweepLimits {
    readonly maxTotalBytes?: number;
    readonly maxAgeMs?: number;
}
export interface SweepResult {
    readonly removed: number;
}
export declare const MAX_TOTAL_BYTES: number;
export declare const MAX_AGE_MS: number;
export declare class InferenceCallStore {
    private readonly _dir;
    private readonly _writes;
    constructor(dir: string);
    record(chatId: string, entry: InferenceCallEntry): Promise<void>;
    recordSent(chatId: string, sent: InferenceCallSent): Promise<void>;
    recordOutcome(chatId: string, verdict: InferenceCallOutcome): Promise<void>;
    list(chatId: string): InferenceCallPage;
    forget(chatId: string): Promise<void>;
    sweep(limits?: SweepLimits): Promise<SweepResult>;
    private _drop;
    private _chatSizes;
}
