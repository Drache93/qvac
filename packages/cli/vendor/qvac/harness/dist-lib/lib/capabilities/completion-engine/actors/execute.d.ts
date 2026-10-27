import { type ToolPreflight } from '../tool-execution.ts';
import type { OutboundGuard, ToolActivityEvent, ToolCallDisplay, ToolDefinition, ToolExecuteContext, ToolExecutionOutcome } from '../../../contract/index.ts';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolPolicySources } from './execution-plan.ts';
import type { HookPipeline } from '../../../hooks/index.ts';
export interface ToolCallPlan {
    resolved: {
        call: {
            id: string;
            name: string;
            arguments: Record<string, unknown>;
            rawCall?: string;
        };
        tool: ToolDefinition;
    };
    context: ToolExecuteContext;
    effect: 'read' | 'write';
    skillName: string | null;
    webSearch: boolean;
}
export interface ToolCallRunOptions {
    approve?: () => Promise<boolean>;
    sources: ToolPolicySources;
    outbound: OutboundGuard;
    preflight: ToolPreflight;
    onDisplay?: (event: ToolActivityEvent) => void;
    signal?: BareAbortSignal;
    denied: Set<string>;
    pipeline: HookPipeline;
    runId: string;
    deniedMessage: string;
    callId: string;
    skipApprovals: boolean;
    intent?: string;
    display?: ToolCallDisplay;
}
export interface ToolCallRunResult {
    output: unknown;
    outcome: ToolExecutionOutcome;
    executed: boolean;
    activity: ToolActivityEvent | null;
}
export declare function runToolCall(plan: ToolCallPlan, options: ToolCallRunOptions): Promise<ToolCallRunResult>;
