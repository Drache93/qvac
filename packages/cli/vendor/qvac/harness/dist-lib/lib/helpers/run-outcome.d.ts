import type { RunOutcome, ToolExecutionOutcome } from '../contract/index.ts';
export type { RunOutcome };
export declare const DEGENERATE_ANSWER_FALLBACK = "I couldn't complete that step and don't have a useful result to share.";
export declare const ROUND_CAP_ANSWER = "I ran out of steps before I could finish that. Ask me to continue and I'll pick up where I left off.";
export declare const SEARCH_CAPPED_ANSWER = "I searched the web but couldn't find the answer in the results I got.";
export declare const DELIVERED_ANSWER = "Your file is attached to the chat.";
export declare const WRITE_RESULT_LEAD = "Here's what came back:";
export declare const TIME_CAPPED_ANSWER = "I hit this run's time budget before I could finish that. Ask me to continue and I'll pick up where I left off.";
export interface RunOutcomeFacts {
    readonly latestFailure: string | null;
    readonly confirmedWrites: ReadonlyArray<string>;
    readonly delivered?: boolean;
}
export interface HistoryTurn {
    readonly role: string;
    readonly content: string;
}
export interface RunOutcomeTracker {
    readonly confirmedWrites: string[];
    beginRound(): void;
    record(result: unknown, outcome: ToolExecutionOutcome): void;
    finishRound(): void;
    confirmWrite(result: unknown): void;
    snapshot(): RunOutcomeState;
    facts(): RunOutcomeFacts;
}
export interface RunOutcomeState {
    confirmedWrites: string[];
    roundFailure: string | null;
    latestFailure: string | null;
    hasRoundResult: boolean;
}
export declare function createRunOutcomeTracker(state?: RunOutcomeState): RunOutcomeTracker;
export declare function normalizeToolExecutionOutcome(result: unknown, outcome: ToolExecutionOutcome): ToolExecutionOutcome;
export declare function failureFromToolExecution(result: unknown, outcome: ToolExecutionOutcome): string | null;
export declare function degenerateAnswer(outcome: Exclude<RunOutcome, 'answered'>, history: ReadonlyArray<HistoryTurn>, facts: RunOutcomeFacts): string;
export declare function lastFailedToolAnswer(history: ReadonlyArray<HistoryTurn>, nudge: string): string | null;
export declare function writeResult(output: unknown): string | null;
export declare function unnamedWrites(answer: string, landed: ReadonlyArray<string>): ReadonlyArray<string>;
export declare function writeReport(landed: ReadonlyArray<string>): string | null;
