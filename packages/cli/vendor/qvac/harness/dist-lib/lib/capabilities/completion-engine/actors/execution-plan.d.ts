import type { ToolDefinition, ToolEffect, ToolExecuteContext, TrustedSource, TrustedSourceFacts } from '../../../contract/index.ts';
import type { ResolvedCall } from '../../../contract/index.ts';
import type { CompletionDeps } from '../session.ts';
import type { ApprovalGate, ResolvedCallSnapshot, ToolExecutionSnapshot } from '../stages.ts';
import type { CompletionContext } from '../../../machine/index.ts';
export interface ToolPolicySources {
    sources: TrustedSource[];
    sourceFacts: TrustedSourceFacts[];
}
interface ResolvedToolCall extends ResolvedCall {
    key: string;
    tool: ToolDefinition;
}
interface OpaqueResolvedCall extends ResolvedCall {
    key: string;
}
export interface ToolExecutionPlan {
    type: 'execute';
    route: 'tool' | 'skill';
    resolved: ResolvedToolCall;
    context: ToolExecuteContext;
    effect: ToolEffect;
    skillName: string | null;
    webSearch: boolean;
}
export declare function resolvedCall(session: CompletionDeps['session'], call: ResolvedCallSnapshot): OpaqueResolvedCall;
interface ToolContextInput {
    deps: CompletionDeps;
    context: CompletionContext;
    name: string;
}
export declare function toolContext({ deps, context, name }: ToolContextInput): ToolExecuteContext;
export interface PlannedCall {
    call: ResolvedCallSnapshot;
    execution: ToolExecutionSnapshot;
}
export declare function executionPlan(deps: CompletionDeps, context: CompletionContext, { call, execution }: PlannedCall): ToolExecutionPlan;
export declare function trustedSources({ args }: CompletionDeps, context: Pick<CompletionContext, 'sources' | 'policy'>): ToolPolicySources;
interface ApprovalGateInput {
    deps: CompletionDeps;
    context: CompletionContext;
    call: ResolvedCallSnapshot;
    tool: ToolDefinition;
    effect: ToolEffect;
    sources: ToolPolicySources;
}
export declare function approvalGate({ deps, context, call, tool, effect, sources }: ApprovalGateInput): ApprovalGate;
export {};
