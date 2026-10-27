import type { AgentPorts, CompletionEvent, CompletionSdk, OutboundGuard } from '../../contract/index.ts';
import { type CompletionArgs } from './loop.ts';
import type { CompletionSkillEntry } from '../skill-entry.ts';
import { type EngineBoot, type EngineStep } from '../../run-log/index.ts';
import type { RunLogRedactor } from '../../run-log/index.ts';
import type { HookPipeline } from '../../hooks/index.ts';
import type { Context } from '../../plugins/index.ts';
export type CompletionRun = AsyncGenerator<CompletionEvent>;
export type CompletionRuntime = (request: CompletionArgs) => Promise<{
    services?: Context;
    sdk?: CompletionSdk;
    args?: Partial<CompletionArgs>;
}>;
export interface CompletionRunOptions {
    pipeline: HookPipeline;
    outbound: OutboundGuard;
    agentPorts: AgentPorts<CompletionSkillEntry>;
    boot?: EngineBoot;
    onStep?: (step: EngineStep) => Promise<void>;
    hostAppendTimeoutMs?: number;
    onDetached?: (pending: Promise<void>, runId?: string) => void;
    requestDigestKey?: Uint8Array;
    redact?: RunLogRedactor;
    redactShared?: <Value>(value: Value) => Value;
    redactOperationResult?: RunLogRedactor['redactOperationResult'];
    redactRecord?: RunLogRedactor['redactRecord'];
    redactStep?: (step: EngineStep) => EngineStep;
    lockOwner?: object;
    resumeRequest?: Partial<CompletionArgs>;
    bootRequest?: unknown;
}
export declare function driveCompletion(args: CompletionArgs, runtime: CompletionRuntime, options: CompletionRunOptions): CompletionRun;
