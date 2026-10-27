export declare const INTENT_PARAM = "intent";
export declare const INTENT_PARAM_DESCRIPTION: string;
export declare function sanitizeToolIntent(value: unknown): string | undefined;
export interface TakenToolIntent {
    args: Record<string, unknown>;
    intent?: string;
}
export declare function takeToolIntent(args: Record<string, unknown>): TakenToolIntent;
