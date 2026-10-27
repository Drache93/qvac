import type { CompletionHistoryEntry, Message, RunGoal, SdkMessage } from '../contract/index.ts';
import { type FailureResultValue } from '../helpers/failure-result.ts';
export declare const DIRECT_CALL_ID = "call-direct";
export declare const PRELOAD_ID_PREFIX = "preload-";
export declare const MAX_TOOL_ROUNDS = 10;
export declare const GOAL_ROUNDS = 40;
export declare const TOOL_CONTINUATION_NUDGE = "[Tool results above. Continue the user's request: call the next tool, or answer.]";
export declare const FILE_DELIVERED_NUDGE = "[Tool results above. The file is attached to the chat and shown to the user. Answer now, unless the request still needs a file that is not made yet.]";
export declare const TOOL_DENIED_MESSAGE: string;
export declare const TOOL_CUT_OFF_MESSAGE: string;
export declare const TOOL_ROUND_CUT_MESSAGE: string;
export declare const TOOL_CONTEXT_BOUNDARY_MESSAGE: string;
export declare const TOOL_REPEATED_MESSAGE: string;
export declare const TOOL_FAILING_MESSAGE: string;
export declare const FAILURE_STREAK = 3;
export declare const TOOL_UNCHANGED_MESSAGE: string;
export declare const GOAL_CONTINUATION_NUDGE: string;
export declare function checkMaxToolRounds(rounds: number): number;
export declare function checkGoal(goal: RunGoal, responseFormat?: unknown): RunGoal;
export declare const TOOL_RESULT_MAX_CHARS = 65536;
export declare function withHookContext(output: unknown, context: string | undefined): unknown;
export declare function deliversFile(output: unknown): boolean;
export declare function toolResultTurn(name: string, id: string, output: unknown): string;
interface ToolResultHistoryInput {
    name: string;
    id: string;
    output: unknown;
    resultRef?: string;
}
export declare function toolResultHistoryEntry({ name, id, output, resultRef }: ToolResultHistoryInput): CompletionHistoryEntry;
export declare function materializeCompletionHistory(history: readonly CompletionHistoryEntry[], values: Readonly<Record<string, FailureResultValue>>): Message[];
export interface FailureTurn extends FailureResultValue {
    at: number;
    callId: string;
    compactedTo?: number;
}
export declare function redactFailureTurns(history: readonly SdkMessage[], failures: readonly FailureTurn[], redact: <Value>(value: Value) => Value): SdkMessage[];
export declare function skillLoadedTurn(name: string, id?: string): string;
export declare function attachmentTurn(name: string, result: unknown): string | null;
export declare function loadedSkillsFrom(messages: readonly Message[]): Set<string>;
export declare function loadedSkillFilesFrom(messages: readonly Message[]): Map<string, Set<string>>;
export declare function historyPayload(output: unknown): unknown;
export {};
