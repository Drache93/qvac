import type { CompletionHistoryEntry, HistorySplice, PlanStep, RoundSpeed, RunBackendUse, ToolSpeed } from '../../contract/run.ts';
import { type FailureResultValue } from '../../helpers/failure-result.ts';
import type { CompletionStats, GoalCheck, RunPolicy, SettledCall, CompletionContext, ResolvedCallSnapshot, ToolPreflightFacts } from './types.ts';
export declare function runsUnasked(facts: Pick<ToolPreflightFacts, 'effect' | 'autoApprove' | 'skipApprovals' | 'permission'>): boolean;
export declare const MAX_MUTE_ROUNDS = 1;
export declare const MAX_CUT_ROUNDS = 2;
export declare const MAX_CAPPED_ROUNDS = 1;
export declare const MAX_BLOCKED_REPEATS = 3;
export declare const MAX_UNCHANGED_RESULTS = 3;
export declare const MAX_ROUND_REPEATS = 3;
export declare const MAX_ROUND_CALLS = 32;
export declare function nudgeWithPlan(nudge: string, plan: readonly PlanStep[]): string;
export declare function goalMet({ plan, goal }: Readonly<CompletionContext>): boolean;
export declare function nudgeWithChecks(nudge: string, checks: readonly GoalCheck[], unnamed?: boolean): string;
export declare function goalTokensLeft({ goal, metrics }: Readonly<CompletionContext>): boolean;
export declare function goalStalled({ outcome }: Readonly<CompletionContext>): boolean;
export declare function retainFailureResults(history: readonly CompletionHistoryEntry[], values: Readonly<Record<string, FailureResultValue>>, failedCalls: Readonly<Record<string, SettledCall>>): Record<string, FailureResultValue>;
export declare function activate(activated: string[], names: readonly string[]): string[];
export interface ApplyHistorySpliceOptions {
    failedCalls?: Readonly<Record<string, SettledCall>>;
    failureResults?: Readonly<Record<string, FailureResultValue>>;
}
export declare function applyHistorySplice(context: Readonly<CompletionContext>, splice?: HistorySplice, options?: ApplyHistorySpliceOptions): Pick<CompletionContext, 'history' | 'failureResults'>;
export interface MetricsState {
    ttft?: number;
    tokens: number;
    timedTokens: number;
    decodeMs: number;
    promptTokens?: number;
    cacheTokens?: number;
    ctxSize?: number | undefined;
    backends?: RunBackendUse[];
    stopReason?: string | undefined;
    rounds: RoundSpeed[];
    tools: ToolSpeed[];
}
export interface FinishedRound {
    stats?: CompletionStats | undefined;
    stopReason?: string | undefined;
    durationMs?: number | undefined;
    ctxSize?: number | undefined;
    overflows?: number | undefined;
    reasoningDeltas?: number | undefined;
}
export declare function foldMetrics(state: MetricsState, round: number, finished: FinishedRound): void;
type StoppedRound = Pick<FinishedRound, 'stats' | 'stopReason'> & {
    cut?: string | undefined;
};
export declare function atContextBoundary({ stats, stopReason }: StoppedRound): boolean;
export declare function cutShort(round: StoppedRound): boolean;
export declare function cutOffMessage(policy: RunPolicy, round: StoppedRound | null): string;
export declare function recordTool(context: Readonly<CompletionContext>, call: ResolvedCallSnapshot | null, durationMs: number | undefined): CompletionContext['metrics'];
export declare function leadingReads(context: Readonly<CompletionContext>): number;
export declare function applySplice(history: CompletionHistoryEntry[], splice?: HistorySplice): CompletionHistoryEntry[];
export {};
