import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolDefinition } from './completion.ts';
import type { NetworkMode } from './policy.ts';
import type { HookRejection, Message, ResourceDescriptor, ToolEffect, ToolExecutionOutcome } from './run.ts';
export type HookPhase = 'runStart' | 'preToolCall' | 'postToolCall' | 'runEnd' | 'runPause' | 'runResume' | 'promptSubmit' | 'toolFailure' | 'stop' | 'preFold';
export interface RunStartPayload {
    readonly phase: 'runStart';
    readonly runId: string;
    readonly agentId: string | null;
    readonly messages: ReadonlyArray<Message>;
}
export interface PreToolCallPayload {
    readonly phase: 'preToolCall';
    readonly runId: string;
    readonly callId: string;
    readonly toolName: string;
    readonly agentId: string | null;
    readonly signal?: BareAbortSignal | undefined;
    readonly skillNames?: readonly string[];
    readonly parameters?: ToolDefinition['parameters'];
    readonly network?: NetworkMode;
    readonly egress?: ToolDefinition['egress'];
    readonly command?: ToolDefinition['command'];
    readonly paths?: (args: Record<string, unknown>) => readonly string[] | null;
    readonly effect: ToolEffect;
    readonly resource: ResourceDescriptor | null;
    args: Record<string, unknown>;
}
export interface PostToolCallPayload {
    readonly phase: 'postToolCall';
    readonly runId: string;
    readonly callId: string;
    readonly toolName: string;
    readonly executed: boolean;
    readonly effect: ToolEffect;
    readonly resource: ResourceDescriptor | null;
    readonly agentId: string | null;
    readonly args: Record<string, unknown>;
    readonly toolset?: string | null;
    readonly outcome?: ToolExecutionOutcome;
    result: unknown;
}
export interface RunEndPayload {
    readonly phase: 'runEnd';
    readonly runId: string;
    readonly agentId: string | null;
    readonly stats: {
        readonly totalTokens: number;
        readonly durationMs: number;
        readonly timeToFirstToken?: number | undefined;
    };
    readonly outcome: 'done' | 'aborted' | 'error' | 'abandoned';
    readonly error?: unknown;
}
export interface RunLifecyclePayload {
    readonly phase: 'runPause' | 'runResume';
    readonly runId: string;
    readonly agentId: string | null;
}
export interface PromptSubmitPayload {
    readonly phase: 'promptSubmit';
    readonly runId: string;
    readonly agentId: string | null;
    readonly mode: 'prompt' | 'steer' | 'follow-up';
    readonly text: string;
}
export interface ToolFailurePayload {
    readonly phase: 'toolFailure';
    readonly runId: string;
    readonly callId: string;
    readonly toolName: string;
    readonly agentId: string | null;
    readonly args: Record<string, unknown>;
    readonly executed: boolean;
    readonly outcome: ToolExecutionOutcome;
    readonly result: unknown;
}
export interface StopPayload {
    readonly phase: 'stop';
    readonly runId: string;
    readonly agentId: string | null;
    readonly round: number;
    readonly response: string;
}
export interface PreFoldPayload {
    readonly phase: 'preFold';
    readonly runId: string;
    readonly agentId: string | null;
    readonly messages: ReadonlyArray<Message>;
}
export type HookContext = RunLifecyclePayload | RunStartPayload | PreToolCallPayload | PostToolCallPayload | RunEndPayload | PromptSubmitPayload | ToolFailurePayload | StopPayload | PreFoldPayload;
export interface PreToolCallResult {
    readonly args?: Record<string, unknown>;
    readonly permission?: 'allow' | 'deny' | 'ask';
    readonly reason?: string;
}
export interface PostToolCallResult {
    readonly result?: unknown;
    readonly context?: string;
}
export interface ContextResult {
    readonly context: string;
}
export interface HaltResult {
    readonly halt: string;
}
export interface ContinueResult {
    readonly continue: string;
}
export interface InstructionsResult {
    readonly instructions: string;
}
export type HookRejectionResult = Omit<HookRejection, 'hook' | 'phase'>;
export type HookResult = PreToolCallResult | PostToolCallResult | ContextResult | HaltResult | ContinueResult | InstructionsResult | HookRejectionResult | void;
export interface HookRunOptions {
    readonly signal?: BareAbortSignal | undefined;
}
export interface HarnessHook {
    readonly name?: string;
    readonly phase: HookPhase;
    readonly matcher?: string;
    readonly timeoutMs?: number;
    run(ctx: HookContext, options?: HookRunOptions): Promise<HookResult> | HookResult;
}
