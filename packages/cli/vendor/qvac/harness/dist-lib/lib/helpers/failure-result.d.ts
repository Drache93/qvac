import type { CompletionHistoryEntry, FailureResultReference } from '../contract/run.ts';
export type StoredFailureResult = {
    value: unknown;
} | {
    undefined: true;
};
export interface FailureResultValue {
    name: string;
    result: StoredFailureResult;
}
export interface ToolDeniedResult {
    error: string;
    denied: true;
}
export declare function toolDeniedResult(message: string): ToolDeniedResult;
export declare function failureResultRef(key: string, round: number, callId: string): string;
export declare function failureResultReference(ref: string, callId: string): FailureResultReference;
export declare function isCompactedLength(value: unknown): value is number;
export declare function isFailureResultReference(entry: CompletionHistoryEntry): entry is FailureResultReference;
export declare function storeFailureResult(value: unknown): StoredFailureResult;
export declare function readFailureResult(value: StoredFailureResult): unknown;
