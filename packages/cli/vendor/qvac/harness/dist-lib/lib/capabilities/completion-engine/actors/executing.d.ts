import type { CompletionActor, CompletionActorInput } from '../session.ts';
import { type ToolExecutionPlan } from './execution-plan.ts';
import { type ToolCallRunResult } from './execute.ts';
import type { CompletionContext } from '../../../machine/index.ts';
import type { CompletionEvent } from '../../../contract/index.ts';
import type { ToolDonePayload, ToolExecutionSnapshot } from '../stages.ts';
export declare const executing: CompletionActor<ToolDonePayload>;
interface RunCallInput {
    plan: ToolExecutionPlan;
    execution: ToolExecutionSnapshot;
    emit(event: CompletionEvent): void;
}
export interface RanCall {
    plan: ToolExecutionPlan;
    denied: Set<string>;
    landedBefore: number;
    executed: ToolCallRunResult;
    durationMs: number;
}
export declare function runCall({ input: deps, context }: CompletionActorInput, { plan: vetted, execution, emit }: RunCallInput): Promise<RanCall>;
interface SettleCallInput {
    ran: RanCall;
    direct: boolean;
    emit(event: CompletionEvent): void;
}
export interface SettledCall extends Omit<ToolDonePayload, 'history' | 'endedRun'> {
    entry: CompletionContext['history'][number];
}
export declare function settleCall({ input: { session }, context }: CompletionActorInput, { ran, direct, emit }: SettleCallInput): SettledCall;
export {};
