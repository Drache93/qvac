import type { AccessPolicy, ToolDefinition, ToolExecuteContext } from '../contract/index.ts';
import type { FollowEvent, FollowHost } from './follow.ts';
export declare const DELEGATE_TOOL_NAME = "delegate";
export interface DelegateRequest {
    runId?: string;
    parentRunId?: string;
    cacheKey?: string;
    signal?: ToolExecuteContext['signal'];
    messages?: ReadonlyArray<{
        role: string;
        content: string;
    }>;
    tools?: ReadonlyArray<{
        name: string;
    }>;
    agent?: {
        handoffs?: unknown;
        policy?: AccessPolicy | null;
    };
    policy?: AccessPolicy;
    resume?: unknown;
    recovery?: unknown;
    input?: unknown;
    goal?: unknown;
}
export type TargetAccess = 'read' | 'write';
export interface TargetTask {
    prompt: string;
    workdir: string;
    access: TargetAccess;
    runId: string | undefined;
    parentRunId: string | undefined;
    deadlineMs: number | undefined;
    onEvent?: (event: TargetEvent) => void;
}
export interface TargetUsage {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    turns?: number;
}
export interface TargetEvent {
    type: 'message' | 'thought' | 'tool' | 'permission' | 'usage' | 'end' | 'error';
    [key: string]: unknown;
}
export interface TargetResult {
    status: 'answered' | 'denied' | 'aborted' | 'budget' | 'error';
    text: string;
    usage?: TargetUsage;
    transcript: TargetEvent[];
}
export interface DelegateTarget {
    name: string;
    description: string;
    policyVersion?: string;
    run(task: TargetTask, signal: AbortSignal): Promise<TargetResult>;
}
export interface DelegateOptions {
    slots?: number;
    targets?: readonly DelegateTarget[];
    read?: readonly string[];
    maxExternal?: number;
}
export interface LocalResult {
    task: string;
    status: 'answered' | 'paused' | 'aborted' | 'error';
    text: string;
}
export interface ExternalResult {
    task: string;
    target: string;
    status: TargetResult['status'];
    text: string;
    usage?: TargetUsage;
}
export type DelegateResult = LocalResult | ExternalResult;
export interface ExternalRun {
    index: number;
    target: string;
    runId: string | undefined;
    parentRunId: string | undefined;
    transcript: TargetEvent[];
}
export declare function createDelegateTool<Request extends DelegateRequest, Event extends FollowEvent>(host: FollowHost<Request, Event>, base: Request, { slots, targets, read, maxExternal }?: DelegateOptions): ToolDefinition;
