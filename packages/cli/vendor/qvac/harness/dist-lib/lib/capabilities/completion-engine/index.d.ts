import type { AgentPorts, CompletionSdk, HarnessHook, OutboundGuard } from '../../contract/index.ts';
import { type EngineBoot, type EngineStep } from '../../run-log/index.ts';
import type { CompletionSkillEntry } from '../skill-entry.ts';
import { type CompletionRun, type CompletionRuntime } from './driver.ts';
import type { CompletionArgs } from './loop.ts';
import { ModelRound } from './model-round.ts';
export interface CompletionEngineOptions {
    hooks?: readonly HarnessHook[];
    outbound?: OutboundGuard;
    agentPorts?: AgentPorts<CompletionSkillEntry>;
    boot?: EngineBoot;
    onStep?: (step: EngineStep) => Promise<void>;
    hostAppendTimeoutMs?: number;
    onDetached?: (pending: Promise<void>, runId?: string) => void;
    requestDigestKey?: Uint8Array;
    resumeRequest?: Partial<CompletionArgs>;
    bootRequest?: unknown;
}
export declare class CompletionEngine {
    static WRAP_UP_PREDICT: number;
    static serveModelRound: typeof ModelRound.serve;
    runtime: CompletionRuntime;
    hooks: readonly HarnessHook[];
    outbound: OutboundGuard;
    agentPorts: AgentPorts<CompletionSkillEntry>;
    options: CompletionEngineOptions;
    constructor(sdk: CompletionSdk | CompletionRuntime, opts?: CompletionEngineOptions);
    run(args: CompletionArgs): CompletionRun;
    static run(sdk: CompletionSdk | CompletionRuntime, args: CompletionArgs, opts?: CompletionEngineOptions): CompletionRun;
}
export type { CompletionArgs } from './loop.ts';
export type { CompletionRun, CompletionRuntime } from './driver.ts';
export type { ModelRoundEvent, ModelRoundIo, ModelRoundPort, ModelRoundRequest, ModelRoundResult, ModelRoundServeOptions } from './model-round.ts';
export { ToolSets } from './tool-sets.ts';
