import type { CompletionEvent as SdkCompletionEvent, CompletionFinal, Tool as SdkTool, ToolCallWithCall, ToolDialect } from '@qvac/inference';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { TextEvent } from '../helpers/thinking.ts';
import type { LlmGenerationParams } from '../models/llm-presets.ts';
import type { CapabilityProfile } from '../models/model-catalog-constants.ts';
import type { DriveRoot } from '../tools/fs/scope.ts';
import type { CliValidator } from '../tools/skills/cli-schema-types.ts';
import type { UsageBreakdown } from '../capabilities/usage-breakdown.ts';
import type { KnowledgeGrant } from './knowledge.ts';
import type { AccessPolicy, CompiledPolicy } from './policy.ts';
import type { GoalStatus, HistoryToolCall, HookRejection, Message, ResourceDescriptor, RoundSpeed, RunBackendUse, RunBudget, RunLifecycleEvent, RunOutcome, ToolActivityEvent, ToolCallDisplay, ToolDecision, ToolEffect, ToolSpeed, TrustedSource, TrustedSourceFacts, TurnContext } from './run.ts';
export type { CliValidator, DriveRoot, LlmGenerationParams };
export interface OutboundGuard {
    facts(origin: TrustedSourceFacts['origin'], text: string): TrustedSourceFacts;
    check(toolName: string, args: Record<string, unknown>, options: {
        readonly sources: readonly TrustedSource[];
        readonly sourceFacts?: readonly TrustedSourceFacts[];
        readonly externalWrite?: boolean;
    }): string | null;
}
export interface AgentHandoff {
    id: string;
    description: string;
}
export interface AgentConfig {
    id?: string;
    name?: string;
    bio?: string;
    enabledTools?: string[] | null;
    enabledSkills?: string[] | null;
    toolsScope?: 'all' | 'selected' | null;
    skillsScope?: 'all' | 'selected' | null;
    reasoning?: 'inherit' | 'enabled' | 'disabled' | null;
    ctxSize?: number | null;
    kvCacheK?: string | null;
    kvCacheV?: string | null;
    imageModelChoice?: string | null;
    imageSteps?: number | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    approvalMode?: 'ask' | 'skip-all' | null;
    disabledToolsets?: string[] | null;
    policy?: AccessPolicy | null;
    handoffs?: AgentHandoff[] | null;
    plan?: boolean | null;
    model?: string | null;
}
export interface ImageSettings {
    modelChoice?: string;
    steps?: number;
    width?: number;
    height?: number;
}
export interface MusicSettings {
    modelChoice?: string;
    steps?: number;
    duration?: number;
}
export type ApproveFn = (call: {
    name: string;
    arguments: Record<string, unknown>;
    callId?: string;
    round?: number;
    resource?: ResourceDescriptor | null;
    effect?: ToolEffect;
    intent?: string | null;
    display?: ToolCallDisplay | null;
    quote?: string | null;
}) => Promise<boolean>;
export type ToolActivityFn = (entry: ToolActivityEvent) => void;
export interface AttachInput {
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
    raw?: boolean;
}
export interface AttachmentRecord {
    id: string;
    fileName: string;
    mimeType: string;
    byteLength: number;
}
export type AttachFn = (input: AttachInput) => Promise<AttachmentRecord>;
export interface AttachmentMeta {
    id: string;
    fileName: string;
    mimeType: string;
    byteLength: number;
}
export interface FetchedAttachment extends AttachmentMeta {
    bytes: Uint8Array;
}
export type FetchAttachmentFn = (query: {
    attachmentId?: string;
    signal?: BareAbortSignal;
    meta?: boolean;
}) => Promise<FetchedAttachment | AttachmentMeta | null>;
export type ProgressFn = (update: {
    percentage: number;
} | null) => void;
export type AskUserFn = (question: {
    question: string;
    options?: string[];
}) => Promise<string | null>;
export interface ToolFetchInit {
    method?: string;
    headers?: Record<string, string> | [string, string][];
    body?: string | Uint8Array | ArrayBuffer;
    signal?: BareAbortSignal;
    redirect?: 'follow' | 'manual' | 'error';
}
export interface ToolFetchResponse {
    readonly status: number;
    readonly ok: boolean;
    readonly url: string;
    readonly redirected: boolean;
    readonly headers: {
        get(name: string): string | null;
        has(name: string): boolean;
        entries(): IterableIterator<[string, string]>;
    };
    text(): Promise<string>;
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
}
export type ToolFetch = (input: string | URL, init?: ToolFetchInit) => Promise<ToolFetchResponse>;
export interface SpillSink {
    write(text: string): void;
    close(): Promise<string | null>;
}
export interface ToolSpill {
    readonly dir: string;
    sink(stream: string): SpillSink;
}
export interface ToolExecuteContext {
    agentId?: string | null | undefined;
    skills?: readonly string[] | undefined;
    skillsLoadedThisTurn?: readonly string[] | undefined;
    runId?: string;
    callId?: string;
    ctxSize?: number | undefined;
    session?: string | undefined;
    image?: ImageSettings | undefined;
    settings?: Record<string, unknown> | undefined;
    turnImages?: {
        path: string;
    }[] | undefined;
    attach?: AttachFn | undefined;
    fetchAttachment?: FetchAttachmentFn | undefined;
    progress?: ProgressFn | undefined;
    askUser?: AskUserFn | undefined;
    signal?: BareAbortSignal | undefined;
    fsRoots?: readonly DriveRoot[] | undefined;
    fsWriteRoots?: readonly DriveRoot[] | undefined;
    toolOps?: ReadonlyMap<string, readonly CliValidator[]> | undefined;
    runBudget?: RunBudget | undefined;
    reportBackend?: ((use: RunBackendUse) => void) | undefined;
    uncappedResponse?: boolean | undefined;
    policy?: CompiledPolicy | undefined;
    toolNames?: readonly string[] | undefined;
    approval?: ToolDecision | undefined;
    fetch?: ToolFetch | undefined;
    knowledge?: KnowledgeGrant | undefined;
    spill?: ToolSpill | undefined;
    planMode?: boolean | undefined;
    callTool?: CallTool | undefined;
    history?: readonly Message[] | undefined;
}
export interface CallTool {
    (name: string, args: unknown): Promise<unknown>;
    readonly names: readonly string[];
}
export type Toolset = 'web-search' | 'knowledge' | 'files' | 'exec' | 'http-request' | 'mcp-call' | 'image' | 'music' | 'coding' | 'team';
export interface ToolsetScoped {
    toolset?: string | null;
}
export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'integer' | 'array' | 'null';
export interface ToolParameterSchema {
    type: ToolParameterType | readonly ToolParameterType[];
    sensitive?: true;
    description?: string;
    enum?: string[];
    items?: ToolParameterSchema;
    properties?: Record<string, ToolParameterSchema>;
    required?: string[];
    default?: unknown;
}
export interface ToolParameters {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
}
export interface ToolPromptDefinition {
    description?: string;
    parameters?: ToolParameters;
}
export type AddonLoaders = Readonly<Record<string, () => Promise<unknown>>>;
export interface ToolDefinition {
    name: string;
    policyVersion?: string;
    description: string;
    parameters: ToolParameters;
    prompt?: ToolPromptDefinition;
    autoApprove?: boolean;
    skillGated?: boolean;
    ungatedFor?: ReadonlyArray<CapabilityProfile>;
    rootsRequired?: boolean;
    writeRootsRequired?: boolean;
    externalWrite?: boolean;
    owningSkill?: string;
    toolset: Toolset | null;
    validate?: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => string | null;
    effect: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => ToolEffect;
    resource?: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => ResourceDescriptor | null;
    quote?: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => string | null;
    egress?: (args: Record<string, unknown>) => string | readonly string[] | null;
    command?: (args: Record<string, unknown>) => string | null;
    paths?: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => readonly string[] | null;
    compiled?: true;
    endsRun?: true;
    concurrent?: true;
    stableRead?: boolean;
    callsTools?: true;
    defer?: true;
    group?: string;
    minCapabilityProfile?: CapabilityProfile;
    landedWrite?: (args: Record<string, unknown>, output: unknown) => string | null;
    addons?: AddonLoaders;
    execute: (args: Record<string, unknown>, ctx?: ToolExecuteContext) => Promise<unknown>;
}
export type ToolCallEvent = {
    type: 'tool-call';
    name: string;
    args: Record<string, unknown>;
    rawCall?: string | undefined;
    effect?: ToolEffect | undefined;
    display?: ToolCallDisplay | undefined;
};
export type ToolResultEvent = {
    type: 'tool-result';
    name: string;
    result: unknown;
};
export type ErrorEvent = {
    type: 'error';
    message: string;
    name?: string;
    code?: string;
    kind?: 'machine' | 'log' | 'xstate';
    found?: string;
    expected?: string;
    forkAt?: number | null;
    forkSafe?: boolean;
    recoveryOperationIds?: string[];
};
export type AbortedEvent = {
    type: 'aborted';
};
export type MetricsEvent = {
    type: 'metrics';
    totalTokens: number;
    durationMs: number;
    modelMs?: number | undefined;
    toolMs?: number | undefined;
    timeToFirstToken?: number | undefined;
    tokensPerSecond?: number | undefined;
    promptTokensPerSecond?: number | undefined;
    promptTokens?: number | undefined;
    cacheTokens?: number | undefined;
    rounds?: RoundSpeed[] | undefined;
    tools?: ToolSpeed[] | undefined;
    ctxSize?: number | undefined;
    backends?: RunBackendUse[] | undefined;
    usage?: UsageBreakdown | undefined;
    stopReason?: string | undefined;
    outcome?: RunOutcome | undefined;
    route?: 'direct' | 'enhanced' | undefined;
    routeModel?: string | undefined;
};
export interface InferenceCall {
    round: number;
    droppedTurns: number;
    modelId: string;
    messages: Message[];
    tools: SdkTool[] | undefined;
    generationParams: Partial<LlmGenerationParams> | undefined;
    responseFormat: ResponseFormat | undefined;
    toolDialect: ToolDialect | undefined;
    cacheKey: string | undefined;
    promptPrefix: string;
}
export type InferenceCallEvent = {
    type: 'inference-call';
    call: InferenceCall;
};
export type TransferEvent = {
    type: 'transfer';
    from: string;
    to: string;
    reason: string;
};
export interface RunInput {
    mode: 'steer' | 'follow-up';
    text: string;
    id?: string;
}
export type InputEvent = {
    type: 'input';
    id?: string;
    text: string;
    round: number;
};
export type ContextEvent = {
    type: 'context';
    id?: string;
    context: TurnContext;
    round: number;
};
export type InputRejectedEvent = {
    type: 'input-rejected';
    reason: string;
};
export type GoalEvent = {
    type: 'goal';
    status: GoalStatus;
    turn: number;
    round: number;
    text?: string;
    checks?: string[];
};
export type FoldEvent = {
    type: 'fold';
    phase: 'start';
} | {
    type: 'fold';
    phase: 'done';
    summary: string;
    throughId: string;
    foldedTurns: number;
};
export type InferenceSentEvent = {
    type: 'inference-sent';
    round: number;
    droppedTurns: number;
    tokens: InferenceTokens | undefined;
    outcome: 'completed' | 'overflowed' | 'failed';
    reason: string | undefined;
};
export interface InferenceTokens {
    prompt?: number | undefined;
    generated?: number | undefined;
    cached?: number | undefined;
    timeToFirstToken?: number | undefined;
}
export type CompletionEvent = (RunLifecycleEvent | TextEvent | ToolCallEvent | ToolResultEvent | ToolActivityEvent | ErrorEvent | AbortedEvent | MetricsEvent | InferenceCallEvent | InferenceSentEvent | TransferEvent | InputEvent | ContextEvent | InputRejectedEvent | GoalEvent | FoldEvent) & {
    runId?: string;
    round?: number;
    callId?: string;
    agent?: string;
};
export interface CompletionSdkResult {
    requestId?: string;
    events: AsyncIterable<SdkCompletionEvent>;
    toolCallStream?: AsyncIterable<{
        call: CompletionFinal['toolCalls'][number];
    }>;
    final: Promise<CompletionFinal>;
}
export type ResponseFormat = {
    type: 'text';
} | {
    type: 'json_object';
} | {
    type: 'json_schema';
    json_schema: {
        name: string;
        description?: string;
        schema: Record<string, unknown>;
        strict?: boolean;
    };
};
export type SdkMessage = Message & {
    toolCalls?: HistoryToolCall[];
    toolCallId?: string;
};
export interface CompletionSdk {
    completion(params: {
        modelId: string;
        history: SdkMessage[];
        stream: true;
        tools?: SdkTool[] | undefined;
        generationParams?: Partial<LlmGenerationParams> | undefined;
        responseFormat?: ResponseFormat | undefined;
        toolDialect?: ToolDialect | undefined;
        kvCache?: string | boolean;
    }): CompletionSdkResult;
    cancel?(params: {
        requestId: string;
    }): Promise<void>;
    deleteCache?(params: {
        kvCacheKey: string;
    }): Promise<{
        success: boolean;
    }>;
}
export interface RoundModelLease {
    modelId: string;
    ctxSize?: number | undefined;
    slots?: number | undefined;
    sdk?: CompletionSdk;
    release: () => void;
}
export interface ResolvedCall {
    call: ToolCallWithCall;
    tool?: ToolDefinition;
    args: Record<string, unknown>;
    rawCall?: string;
    intent?: string;
    rejection?: HookRejection;
    permission?: 'allow' | 'ask';
}
