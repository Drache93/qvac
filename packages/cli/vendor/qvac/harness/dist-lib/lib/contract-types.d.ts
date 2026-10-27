import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { HarnessCapabilityProfile } from '../spec/hyperschema/types.d.ts';
import type { AccessPolicy, AgentHandoff, ApproveFn, AskUserFn, AttachFn, FetchAttachmentFn, HistoryToolCall, ProgressFn, ResourceDescriptor, ResponseFormat } from './contract/index.ts';
import type { KvCacheDeletionResult } from './capabilities/kv-cache.ts';
import type { ModelRoundIo, ModelRoundPort, ModelRoundRequest, ModelRoundResult } from './capabilities/completion-engine/index.ts';
import type { ModelSourcePreview, PreviewModelSourceContext } from './capabilities/preview-model-source.ts';
import type { MemoryBudget } from './hardware/memory-budget.ts';
import type { EmbedDevice } from './models/embed-config.ts';
import type { LlmGenerationParams } from './models/llm-presets.ts';
import type { CustomModelEntry } from './models/model-catalog.ts';
import type { DeleteModelSummary } from './models/model-delete.ts';
import type { ListModelsOptions, ModelInfo } from './models/model-list.ts';
import type { ToolCatalogEntry } from './tools/catalog.ts';
import type { ManagedSkill, SkillFileContent } from './tools/skills/overlay-crud.ts';
import type { DriveOpFn, GrantedDrive } from './tools/fs/remote-protocol.ts';
import type { SpeakResult } from './contract/speech.ts';
import type { RunInput } from './contract/completion.ts';
import type { RunGoal, TurnContext } from './contract/run.ts';
import type { KnowledgeArtifact, KnowledgeGrant, KnowledgeHit, KnowledgeQuery, KnowledgeRemoved, KnowledgeStatus, KnowledgeUpsertResult } from './contract/knowledge.ts';
import type { ResolvedSkillCatalogEntry } from './tools/skills/catalog.ts';
import type { InstallStep, SkillSetup } from './tools/skills/manifest.ts';
import type { EngineBoot, EngineStep, HostRunLog, HostRunLogLease, RecoveryResolution, RunRecord } from './run-log/index.ts';
export type { InstallStep, ListModelsOptions, ModelInfo, ResolvedSkillCatalogEntry, ResourceDescriptor, RunRecord, SkillSetup, ToolCatalogEntry };
export type { HostRunLog, HostRunLogLease, SpeakResult };
export type ApprovalCall = Parameters<ApproveFn>[0];
export type ChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    attachments?: {
        path: string;
    }[];
    toolCalls?: HistoryToolCall[] | null;
    toolCallId?: string | null;
    name?: string | null;
    id?: string | null;
    context?: TurnContext | null;
    sentAt?: number | undefined;
};
export interface AgentKnobs {
    id?: string;
    name?: string;
    bio?: string;
    reasoning?: 'inherit' | 'enabled' | 'disabled' | null;
    enabledTools?: string[] | null;
    enabledSkills?: string[] | null;
    toolsScope?: 'all' | 'selected' | null;
    skillsScope?: 'all' | 'selected' | null;
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
export interface CompletionContext {
    runId?: string;
    parentRunId?: string;
    resume?: boolean;
    recovery?: RecoveryResolution[];
    model: string;
    agent: AgentKnobs;
    agents?: Record<string, AgentKnobs>;
    messages: ChatMessage[];
    typedText?: string;
    cacheKey?: string;
    replaysContext?: boolean;
    session?: string;
    thinkingDefault?: string;
    toolConfigs?: Record<string, Record<string, unknown>>;
    generationParams?: LlmGenerationParams;
    responseFormat?: ResponseFormat;
    captureInferenceCalls?: boolean;
    maxToolRounds?: number;
    knowledge?: KnowledgeGrant;
    planMode?: boolean;
    deferTools?: boolean;
    goal?: RunGoal;
    grantedDirs?: string[];
    grantedDrives?: GrantedDrive[];
    driveOp?: DriveOpFn;
    grantedWriteDirs?: string[];
    approve?: (call: ApprovalCall) => Promise<boolean>;
    attach?: AttachFn;
    fetchAttachment?: FetchAttachmentFn;
    progress?: ProgressFn;
    askUser?: AskUserFn;
    runLog?: HostRunLog;
    boot?: EngineBoot;
    onStep?: (step: EngineStep) => Promise<void>;
    hostAppendTimeoutMs?: number;
    requestDigestKey?: Uint8Array;
    signal?: BareAbortSignal;
    input?: AsyncIterable<RunInput>;
    roundCut?: (cut: (note: string) => void) => void;
    modelRound?: ModelRoundPort;
}
export interface HostSignal {
    aborted?: boolean;
    addEventListener?: (type: 'abort', fn: () => void, opts?: {
        once?: boolean;
    }) => void;
    removeEventListener?: (type: 'abort', fn: () => void) => void;
}
export type HostContext<T> = T extends unknown ? Omit<T, 'signal'> & {
    signal?: HostSignal;
} : never;
export type ResumeCompletionContext = Omit<Partial<CompletionContext>, 'runId' | 'resume'> & {
    runId: string;
    resume: true;
};
export interface InvokeContext {
    capability: string;
    args: Record<string, unknown>;
    enhance?: 'never' | 'auto';
    agent?: AgentKnobs;
    attach?: AttachFn;
    fetchAttachment?: FetchAttachmentFn;
    progress?: ProgressFn;
    signal?: CompletionContext['signal'];
}
export interface DetectLanguageContext {
    text: string;
    topK?: number;
}
export interface DetectedLanguage {
    code: string;
    language: string;
    probability?: number;
}
export interface HarnessEvent {
    type: string;
    text?: string;
    message?: string;
    [key: string]: unknown;
}
export interface LoadFit {
    verdict: 'fit' | 'does-not-fit' | 'unknown';
    reason: string;
    plan?: {
        nCtx: number;
        nGpuLayers: number;
        nGpuDevices: number;
    } | undefined;
    deviceBytes?: number | undefined;
    hostBytes?: number | undefined;
}
export interface LoadedModel {
    model: string;
    refs: number;
    fit?: LoadFit;
}
export interface DownloadsAllowedOptions {
    allowed: boolean;
}
export interface ModelState {
    status: string;
    model?: string;
    percentage?: number;
    downloaded?: number;
    total?: number;
    message?: string;
    catalogChanged?: boolean;
    loaded?: LoadedModel[];
    addon?: string | null;
}
export interface WarmModelContext {
    model: string;
    agent?: AgentKnobs;
    signal?: CompletionContext['signal'];
}
export type LoadModelContext = WarmModelContext;
export interface LoadModelResult {
    loaded: boolean;
    reason?: 'memory';
}
export interface MemoryUsage {
    readonly usedBytes: number;
}
export interface UnloadModelContext {
    model: string;
}
export interface UnloadModelResult {
    unloaded: boolean;
}
export interface DownloadContext {
    model: string;
    addon?: string;
    seed?: boolean;
    signal?: CompletionContext['signal'];
}
export interface EmbedContext {
    model: string;
    texts: string[];
    signal?: CompletionContext['signal'];
}
export interface TranscribeContext {
    model: string;
    audio: Buffer;
    signal?: CompletionContext['signal'];
}
export interface SpeakContext {
    model: string;
    text: string;
    signal?: CompletionContext['signal'];
}
export interface SpeakStreamContext {
    model: string;
    text: AsyncIterable<string>;
    signal?: CompletionContext['signal'];
}
export interface HarnessDiagnostics {
    models: LoadedModel[];
    suspended: boolean;
    sdkLoaded: boolean;
    toolNames: string[];
    skills: string[];
    device?: 'cpu' | 'gpu';
}
export interface HarnessInfo {
    toolNames: string[];
    skills: string[];
    supportsImages: boolean;
    supportsKvCacheDeletion?: boolean;
}
export interface CapabilityInfo {
    completionRecovery?: boolean;
    hostRunLog?: boolean;
    hostRunLogVersion?: number;
    capabilityProfile: HarnessCapabilityProfile;
    recommendedModelName: string;
    memoryBudget?: MemoryBudget;
    mobile: boolean;
}
export interface CredentialEntry {
    key: string;
    token?: string | null;
    expiresAt?: number | null;
    agentId?: string | null;
    skill?: string | null;
}
export interface SkillsOptions {
    readonly refresh?: boolean;
    readonly skipCredentialProbe?: boolean;
}
export interface SkillWriteResult {
    ok: boolean;
}
export interface InfraModel {
    name: string;
    addon: string;
}
export interface HarnessContract {
    completion(context: CompletionContext | ResumeCompletionContext): AsyncIterable<HarnessEvent>;
    serveModelRound?(request: ModelRoundRequest, io: ModelRoundIo): Promise<ModelRoundResult>;
    invoke?(context: InvokeContext): AsyncIterable<HarnessEvent>;
    download?(context: DownloadContext): AsyncIterable<HarnessEvent>;
    describe?(): Promise<HarnessInfo | null> | HarnessInfo;
    embed?(context: EmbedContext): Promise<number[][]>;
    transcribe?(context: TranscribeContext): Promise<string>;
    detectLanguage?(context: DetectLanguageContext): DetectedLanguage[] | Promise<DetectedLanguage[]>;
    speak?(context: SpeakContext): Promise<SpeakResult>;
    speakStream?(context: SpeakStreamContext): AsyncIterable<SpeakResult>;
    getEmbeddingDevice?(): EmbedDevice | Promise<EmbedDevice>;
    setEmbeddingDevice?(device: EmbedDevice): Promise<void> | void;
    on?(event: 'model', listener: (state: ModelState) => void): unknown;
    off?(event: 'model', listener: (state: ModelState) => void): unknown;
    presuspend?(): Promise<void> | void;
    suspend?(): Promise<void> | void;
    wakeup?(): Promise<void> | void;
    resume?(): Promise<void> | void;
    skills?(agentId?: string | null, modelName?: string | null, options?: SkillsOptions): Promise<ResolvedSkillCatalogEntry[]>;
    tools?(): Promise<ToolCatalogEntry[]>;
    setCredentials?(entries: ReadonlyArray<CredentialEntry>): void | Promise<void>;
    setSkillSettings?(entries: ReadonlyArray<{
        skill: string;
        key: string;
        value: string;
        agentId?: string | null;
    }>): void | Promise<void>;
    setModelIdleTimeout?(ms: number): void | Promise<void>;
    setModelMemoryCap?(percent: number): void | Promise<void>;
    memoryUsage?(): Promise<MemoryUsage>;
    setDownloadsAllowed?(options: DownloadsAllowedOptions): void | Promise<void>;
    listManagedSkills?(): Promise<ManagedSkill[]>;
    readSkillFile?(name: string): Promise<SkillFileContent | null>;
    writeSkillFile?(name: string, content: string): Promise<{
        readonly ok: boolean;
    }>;
    copyBaseForEdit?(name: string): Promise<{
        readonly copied: boolean;
    }>;
    deleteOverlaySkill?(name: string): Promise<{
        readonly removed: boolean;
    }>;
    list?(options?: ListModelsOptions): Promise<ModelInfo[]>;
    warmModel?(context: WarmModelContext): Promise<void>;
    loadModel?(context: LoadModelContext): Promise<LoadModelResult>;
    unloadModel?(context: UnloadModelContext): Promise<UnloadModelResult>;
    deleteModel?(name: string): Promise<DeleteModelSummary>;
    clearKvCache?(): Promise<KvCacheDeletionResult>;
    deleteKvCache?(kvCacheKey: string): Promise<KvCacheDeletionResult>;
    infraModels?(profile: string): Promise<ReadonlyArray<InfraModel>>;
    setCustomModels?(entries: ReadonlyArray<CustomModelEntry>): void | Promise<void>;
    previewModelSource?(context: PreviewModelSourceContext): Promise<ModelSourcePreview>;
    capability?(): Promise<CapabilityInfo>;
    diagnostics?(): HarnessDiagnostics;
    knowledgeUpsert?(artifact: KnowledgeArtifact): Promise<KnowledgeUpsertResult>;
    knowledgeRemove?(artifactId: string): Promise<KnowledgeRemoved>;
    knowledgeSearch?(query: Omit<KnowledgeQuery, 'signal'>): Promise<KnowledgeHit[]>;
    knowledgeStatus?(): Promise<KnowledgeStatus>;
}
export interface HarnessStatus {
    state: 'running' | 'died';
    error?: string;
    code?: string;
}
