import type { Tool as SdkTool } from '@qvac/inference';
import type { HookPipeline } from '../../hooks/index.ts';
import { type RunOutcomeTracker } from '../../helpers/run-outcome.ts';
import type { AgentPolicy, AgentPorts, CompletionEvent, CliValidator, CompiledPolicy, CompletionSdk, DriveRoot, LlmGenerationParams, OutboundGuard, RunBackendUse, RunBudget, SkillActivation, ToolDefinition } from '../../contract/index.ts';
import type { CompletionArgs, ToolContextFactory } from './loop.ts';
import type { CompletionSkillEntry } from '../skill-entry.ts';
import type { PromptUsageChars } from '../usage-breakdown.ts';
import type { EngineOperationPort } from './engine.ts';
import type { Context } from '../../plugins/index.ts';
import type { InvokeTracker } from './ports.ts';
import type { LiveRound } from './round.ts';
import type { CompletionActorOutput, CompletionContext } from '../../machine/index.ts';
export declare const RUNTIME_BINDINGS: readonly ['approve', 'attach', 'fetchAttachment', 'askUser', 'modelRound'];
export type RuntimeBinding = (typeof RUNTIME_BINDINGS)[number];
export interface Session extends InvokeTracker {
    bindings: RuntimeBinding[];
    runId: string;
    pipeline: HookPipeline;
    outbound: OutboundGuard;
    enabled: ToolDefinition[];
    sdkTools: SdkTool[] | undefined;
    grantedOps: Map<string, CliValidator[]>;
    behaviorDigest: string;
    activation: SkillActivation;
    inContextSkills: CompletionSkillEntry[];
    loadedThisTurn: Set<string>;
    loadedFilesThisTurn: Set<string>;
    loadedSkillFiles: Map<string, Set<string>>;
    nudgedSkills: Set<string>;
    backends: RunBackendUse[];
    landed: string[];
    runOutcomes: RunOutcomeTracker;
    callKey(name: string, args: Record<string, unknown>): string;
    resultDigest(output: unknown): string;
    skillIcon: string | null;
    writableRoots: DriveRoot[];
    runBudget: RunBudget;
    toolContext: ToolContextFactory;
    turnImages: {
        path: string;
    }[];
    generationParams: LlmGenerationParams | undefined;
    policy: AgentPolicy;
    access: CompiledPolicy | undefined;
    accessDigest: string | null;
    agentPorts: AgentPorts<CompletionSkillEntry>;
    runStarted: boolean;
    promptParts: PromptUsageChars | null;
    startedAt: number;
    now: () => number;
    wallStart: number;
    reselectTools: ((loadedSkills: ReadonlySet<string>) => string) | null;
    preloadSystem: ((skill: string) => string) | null;
    liveRound: LiveRound | null;
}
export interface CompletionDeps {
    services?: Context;
    sdk?: CompletionSdk;
    args: CompletionArgs;
    session: Session;
    operations: EngineOperationPort;
    commitFacts?: () => void;
    commitSettledFacts?: (operationId: string) => void;
}
export interface CompletionActorInput {
    input: CompletionDeps;
    context: CompletionContext;
    signal: CompletionInvocationSignal;
    reconstruct?: boolean;
    emit(event: CompletionEvent): void;
}
export interface CompletionInvocationSignal {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void): void;
    removeEventListener(type: 'abort', listener: () => void): void;
}
export type CompletionActor<Output = CompletionActorOutput> = (input: CompletionActorInput) => Promise<Output>;
export interface CreateSessionOptions {
    runId: string;
    invokes?: InvokeTracker;
    now?: () => number;
    wallStart?: number;
    requestDigestKey?: Uint8Array;
    digestRunId?: string;
    pipeline: HookPipeline;
    outbound: OutboundGuard;
    agentPorts: AgentPorts<CompletionSkillEntry>;
}
export declare function loadedSkills(context: CompletionContext, session: Session): Set<string>;
export declare function createSession(args: CompletionArgs, options: CreateSessionOptions): Session;
