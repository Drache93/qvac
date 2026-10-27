import type { CompletionHistoryEntry, PlanStep, RunGoal } from '../../contract/run.ts';
import type { CompletionContext, RunPolicy } from './types.ts';
export interface EmptyCompletionContextOptions {
    policy: RunPolicy;
    runId?: string;
    history?: CompletionHistoryEntry[];
    agentId?: string | null;
    ctxSize?: number;
    cacheKey?: string | null;
    planMode?: boolean;
    plan?: PlanStep[];
    goal?: RunGoal;
}
export declare function emptyCompletionContext(opts: EmptyCompletionContextOptions): CompletionContext;
