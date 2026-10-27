import type { ToolCallWithCall } from '@qvac/inference';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { HookPipeline } from '../../hooks/index.ts';
import type { NetworkMode, PreToolCallPayload, ToolFailurePayload } from '../../contract/index.ts';
import type { ApproveFn, OutboundGuard, ResolvedCall, ResourceDescriptor, ToolActivityFn, ToolCallDisplay, ToolDefinition, ToolEffect, ToolExecuteContext, ToolExecutionOutcome, TrustedSource, TrustedSourceFacts } from '../../contract/index.ts';
import type { ToolPreflightFacts } from './stages.ts';
export declare function callSucceeded(result: unknown, outcome: ToolExecutionOutcome): boolean;
export declare function answerOf(result: unknown): string | undefined;
export declare function settledFailure(result: unknown, outcome: ToolExecutionOutcome): boolean;
export interface ExecuteCallOptions {
    runId: string;
    deniedMessage: string;
    approve?: ApproveFn | undefined;
    signal?: BareAbortSignal | undefined;
    denied?: Set<string>;
    sources?: readonly TrustedSource[];
    sourceFacts?: readonly TrustedSourceFacts[];
    outbound: OutboundGuard;
    pipeline: HookPipeline;
    callId: string;
    effect?: ToolEffect | undefined;
    skipApprovals?: boolean;
    preflight?: ToolPreflight;
    onToolActivity?: ToolActivityFn;
    intent?: string | undefined;
    display?: ToolCallDisplay | undefined;
}
export interface ExecutedCall {
    readonly result: unknown;
    readonly outcome: ToolExecutionOutcome;
    readonly executed: boolean;
}
export type ToolPreflight = {
    status: 'blocked';
    reason: 'validation' | 'refusal';
    result: unknown;
    effect: ToolEffect;
} | {
    status: 'denied';
    result: {
        error: string;
        denied: true;
    };
    key: string;
} | {
    status: 'ready';
    key: string;
    effect: ToolEffect;
    resource: ResourceDescriptor | null;
    autoRun: boolean;
    permission?: 'allow' | 'ask' | undefined;
};
interface ToolPolicyOptions extends Pick<ExecuteCallOptions, 'sources' | 'sourceFacts' | 'outbound' | 'denied' | 'effect' | 'skipApprovals'> {
    key?: string;
    permission?: 'allow' | 'ask' | undefined;
}
interface PreflightOptions extends ToolPolicyOptions, Pick<ExecuteCallOptions, 'deniedMessage'> {
}
export declare function preflightToolCall(tool: ToolDefinition, args: Record<string, unknown>, ctx: ToolExecuteContext, options: PreflightOptions): ToolPreflight;
export declare function inspectToolPolicy(tool: ToolDefinition, args: Record<string, unknown>, ctx: ToolExecuteContext, options: ToolPolicyOptions): ToolPreflightFacts;
type ReadyToolPreflight = Extract<ToolPreflight, {
    status: 'ready';
}>;
export declare function readyPreflightFromFacts(facts: ToolPreflightFacts): ReadyToolPreflight;
export declare function executeCall(tool: ToolDefinition, args: Record<string, unknown>, ctx: ToolExecuteContext, { runId, deniedMessage, approve, signal, denied, sources, sourceFacts, outbound, pipeline, callId, effect: classified, skipApprovals, preflight: prepared, onToolActivity, intent, display }: ExecuteCallOptions): Promise<ExecutedCall>;
export declare function reportFailure(pipeline: HookPipeline, failure: Omit<ToolFailurePayload, 'phase'>): Promise<unknown>;
export declare function ruleInputs(tool: ToolDefinition, ctx: ToolExecuteContext | undefined): Pick<PreToolCallPayload, 'command' | 'paths'>;
export interface ResolveToolCallsOptions {
    runId: string;
    agentId: string | null;
    pipeline: HookPipeline;
    skillNames: readonly string[];
    network: NetworkMode;
    toolContext: (name: string) => ToolExecuteContext;
    signal?: BareAbortSignal | undefined;
}
export declare function resolveToolCalls(toolCalls: ToolCallWithCall[], enabled: readonly ToolDefinition[], { runId, agentId, pipeline, skillNames, network, toolContext, signal }: ResolveToolCallsOptions): Promise<ResolvedCall[]>;
export {};
