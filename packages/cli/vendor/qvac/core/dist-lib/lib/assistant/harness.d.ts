import type { AbortSignal } from 'bare-abort-controller';
import type { ApprovalCall, CompletionEvent, DeleteModelSummary, DriveOpFn, GrantedDrive, HostRunLog, ManagedSkill, MemoryBudget, ModelRoundIo, ModelRoundPort, ModelRoundRequest, ModelRoundResult, ModelSourcePreview, PreviewModelSourceContext, SkillFileContent } from '@qvac/harness';
import type { SkillCatalogOptions, SkillManagementHooks } from '../core.ts';
import type { AssistantAgent, AssistantCapabilityProfile, AssistantChunkContentAttachment, AssistantCustomModelPreview, AssistantDeleteModelRequest, AssistantDetectLanguageRequest, AssistantDetectLanguageResponse, AssistantDeleteModelResponse, AssistantEnhanceMode, AssistantKvCacheDeletionResponse, AssistantListModelsRequest, AssistantModelInfoList, AssistantPreviewCustomModelRequest, AssistantSkillCatalogResponse, AssistantSpeakRequest, AssistantSpeakResponse, AssistantToolCatalogResponse, AssistantToolReportEntry, AssistantTranscribeRequest, AssistantTranscribeResponse } from '../../spec/hyperschema/types.d.ts';
import type { HarnessDiagnostics } from '../diagnostics.ts';
import type { DownloadArgs, DownloadEventStream, ImageDownloadObservation } from '../model-download.ts';
import type { RunInput } from '../run-input.ts';
import type { AttachInput, AttachmentMeta, ChatMessage, FetchedAttachment } from './message.ts';
import type { Skill } from './skill-encode.ts';
export interface HarnessEvent {
    type: string;
    text?: string;
    message?: string;
    [key: string]: unknown;
}
export interface DetectedLanguage {
    code: string;
    language: string;
    probability?: number;
}
export type HarnessEventOf<Type extends CompletionEvent['type']> = HarnessEvent & CompletionEvent & {
    type: Type;
};
export declare function isHarnessEvent<Type extends CompletionEvent['type']>(event: HarnessEvent, type: Type): event is HarnessEventOf<Type>;
export interface ModelState {
    status: string;
    model?: string;
    percentage?: number;
    downloaded?: number;
    total?: number;
    catalogChanged?: boolean;
}
export interface HarnessInfo {
    toolNames: string[];
    skills: string[];
    supportsImages: boolean;
}
export type ModelType = string;
export interface ModelInfo {
    name: string;
    type: ModelType;
    registryPath: string;
    registrySource: string;
    isCached: boolean;
    isLoaded: boolean;
    isLoading?: boolean;
    supportsImages?: boolean;
    expectedSize: number;
    actualSize?: number;
    taskType?: string;
    memoryBytes?: number;
}
export interface ListModelsOptions {
    type?: ModelType;
    cachedOnly?: boolean;
    fullRegistry?: boolean;
}
export type { DeleteModelSummary };
export interface ToolCatalogEntry {
    name: string;
    description: string;
    skillGated: boolean;
    scopeRequired: boolean;
    toolset?: string | null;
    rootsRequired?: boolean;
    writeRootsRequired?: boolean;
    promptChars?: number;
}
export interface DeviceCapability {
    capabilityProfile: AssistantCapabilityProfile;
    recommendedModelName: string;
    memoryBudget?: MemoryBudget;
    hostRunLog?: boolean;
    hostRunLogVersion?: number;
}
export interface ImageProgress {
    readonly percentage: number;
}
export interface FetchAttachmentOptions {
    readonly attachmentId?: string;
    readonly kind?: 'image' | 'audio';
    readonly signal?: AbortSignal;
    readonly meta?: boolean;
}
export interface Harness {
    completion(context: {
        runId?: string;
        runLog?: HostRunLog;
        model: string;
        agent: AssistantAgent;
        messages: ChatMessage[];
        typedText?: string;
        cacheKey?: string;
        replaysContext?: boolean;
        deferTools?: boolean;
        modelRound?: ModelRoundPort;
        session?: string;
        thinkingDefault?: string;
        toolConfigs?: Record<string, Record<string, unknown>>;
        captureInferenceCalls?: boolean;
        grantedDirs?: string[];
        grantedDrives?: GrantedDrive[];
        driveOp?: DriveOpFn;
        grantedWriteDirs?: string[];
        generationParams?: {
            temp?: number;
            top_p?: number;
            top_k?: number;
            presence_penalty?: number;
            repeat_penalty?: number;
            frequency_penalty?: number;
            reasoning_budget: 0 | -1;
        };
        responseFormat?: {
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
        approve?: (call: ApprovalCall) => Promise<boolean>;
        attach?: (input: AttachInput) => Promise<AssistantChunkContentAttachment>;
        fetchAttachment?: (query: FetchAttachmentOptions) => Promise<FetchedAttachment | AttachmentMeta | null>;
        progress?: (update: ImageProgress | null) => void;
        input?: AsyncIterable<RunInput>;
        signal?: AbortSignal;
    }): AsyncIterable<HarnessEvent>;
    serveModelRound?(request: ModelRoundRequest, io: ModelRoundIo): Promise<ModelRoundResult>;
    invoke?(context: {
        capability: string;
        args: Record<string, unknown>;
        enhance?: AssistantEnhanceMode;
        agent?: AssistantAgent;
        attach?: (input: AttachInput) => Promise<AssistantChunkContentAttachment>;
        fetchAttachment?: (query: FetchAttachmentOptions) => Promise<FetchedAttachment | AttachmentMeta | null>;
        progress?: (update: ImageProgress | null) => void;
        signal?: AbortSignal;
    }): AsyncIterable<HarnessEvent>;
    describe?(): Promise<HarnessInfo | null> | HarnessInfo;
    embed?(context: {
        model: string;
        texts: string[];
        signal?: AbortSignal;
    }): Promise<number[][]>;
    list?(options?: ListModelsOptions): Promise<ReadonlyArray<ModelInfo>>;
    warmModel?(context: {
        model: string;
        agent?: AssistantAgent;
        signal?: AbortSignal;
    }): Promise<void>;
    loadModel?(context: {
        model: string;
        agent?: Pick<AssistantAgent, 'ctxSize' | 'kvCacheK' | 'kvCacheV'>;
    }): Promise<{
        loaded: boolean;
        reason?: 'memory';
    }>;
    unloadModel?(context: {
        model: string;
    }): Promise<{
        unloaded: boolean;
    }>;
    deleteModel?(name: string): Promise<DeleteModelSummary>;
    clearKvCache?(): Promise<AssistantKvCacheDeletionResponse>;
    deleteKvCache?(kvCacheKey: string): Promise<AssistantKvCacheDeletionResponse>;
    infraModels?(profile: string): Promise<ReadonlyArray<{
        name: string;
        addon: string;
    }>>;
    capability?(): Promise<DeviceCapability>;
    download?(args: DownloadArgs): DownloadEventStream;
    transcribe?(context: {
        model: string;
        audio: Buffer;
        signal?: AbortSignal;
    }): Promise<string>;
    detectLanguage?(context: {
        text: string;
        topK?: number;
    }): Promise<ReadonlyArray<DetectedLanguage>> | ReadonlyArray<DetectedLanguage>;
    speak?(context: {
        model: string;
        text: string;
        signal?: AbortSignal;
    }): Promise<{
        audio: Buffer;
        sampleRate: number;
    }>;
    speakStream?(context: {
        model: string;
        text: AsyncIterable<string>;
        signal?: AbortSignal;
    }): AsyncIterable<{
        audio: Buffer;
        sampleRate: number;
    }>;
    setCredentials?(entries: ReadonlyArray<{
        key: string;
        token?: string | null;
        expiresAt?: number | null;
        agentId?: string | null;
    }>): void | Promise<void>;
    setCustomModels?(entries: ReadonlyArray<{
        name: string;
        src: string;
        projectionSrc?: string;
        taskType?: string;
        expectedSize?: number;
        label?: string;
        contextLength?: number;
    }>): void | Promise<void>;
    setModelIdleTimeout?(ms: number): void | Promise<void>;
    setModelMemoryCap?(percent: number): void | Promise<void>;
    memoryUsage?(): Promise<{
        usedBytes: number;
    }>;
    setDownloadsAllowed?(request: {
        allowed: boolean;
    }): void | Promise<void>;
    previewModelSource?(input: PreviewModelSourceContext): Promise<ModelSourcePreview>;
    on?(event: 'model' | 'status', listener: (...args: never[]) => void): unknown;
    off?(event: 'model' | 'status', listener: (...args: never[]) => void): unknown;
    presuspend?(): Promise<void> | void;
    suspend?(): Promise<void> | void;
    wakeup?(): Promise<void> | void;
    resume?(): Promise<void> | void;
    skills?(agentId?: string | null, modelName?: string | null, options?: SkillCatalogOptions): Promise<ReadonlyArray<Skill>>;
    tools?(): Promise<ReadonlyArray<ToolCatalogEntry>>;
    listManagedSkills?(): Promise<ReadonlyArray<ManagedSkill>>;
    readSkillFile?(name: string): Promise<SkillFileContent | null>;
    writeSkillFile?(name: string, content: string): Promise<{
        ok: boolean;
    }>;
    copyBaseForEdit?(name: string): Promise<{
        copied: boolean;
    }>;
    deleteOverlaySkill?(name: string): Promise<{
        removed: boolean;
    }>;
    diagnostics?(): HarnessDiagnostics;
    fetchDiagnostics?(): Promise<HarnessDiagnostics | null>;
    toolNames?: string[];
    skillNames?: string[];
    supportsImages?: boolean;
    supportsImagesFor?(model: string): boolean;
}
export declare function harnessListModels(harness: Pick<Harness, 'list'>): (options: AssistantListModelsRequest) => Promise<AssistantModelInfoList>;
export declare function harnessDeleteModel(harness: Pick<Harness, 'deleteModel'>): (options: AssistantDeleteModelRequest) => Promise<AssistantDeleteModelResponse>;
export declare function harnessClearKvCache(harness: Pick<Harness, 'clearKvCache'>): () => Promise<AssistantKvCacheDeletionResponse>;
type SameFields<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [
    never,
    never
] ? true : {
    onlyInHarness: Exclude<keyof A, keyof B>;
    onlyInCore: Exclude<keyof B, keyof A>;
};
export declare const PREVIEW_CONTRACT_MATCHES: SameFields<ModelSourcePreview, AssistantCustomModelPreview>;
export declare const DELETE_CONTRACT_MATCHES: SameFields<DeleteModelSummary, AssistantDeleteModelResponse>;
export declare function harnessPreviewModelSource(harness: Pick<Harness, 'previewModelSource'>): (request: AssistantPreviewCustomModelRequest) => Promise<AssistantCustomModelPreview>;
export declare function harnessTranscribe(harness: Pick<Harness, 'transcribe'>): (request: AssistantTranscribeRequest) => Promise<AssistantTranscribeResponse>;
export declare function harnessDetectLanguage(harness: Pick<Harness, 'detectLanguage'>): (request: AssistantDetectLanguageRequest) => Promise<AssistantDetectLanguageResponse>;
export declare function harnessSpeak(harness: Pick<Harness, 'speak'>): (request: AssistantSpeakRequest) => Promise<AssistantSpeakResponse>;
export declare function harnessSkillCatalog(harness: Pick<Harness, 'skills'>, syncCredentials?: () => Promise<void> | undefined): (agentId?: string | null, modelName?: string | null, options?: SkillCatalogOptions) => Promise<AssistantSkillCatalogResponse>;
export declare function harnessSkillManagement(harness: Pick<Harness, 'listManagedSkills' | 'readSkillFile' | 'writeSkillFile' | 'copyBaseForEdit' | 'deleteOverlaySkill'>): SkillManagementHooks;
export declare function harnessTools(harness: Pick<Harness, 'tools'>): () => Promise<AssistantToolCatalogResponse>;
export declare function toolReportEntry(tool: ToolCatalogEntry): AssistantToolReportEntry;
export declare function harnessSpeakStream(harness: Pick<Harness, 'speakStream'>): (text: AsyncIterable<string>) => AsyncIterable<AssistantSpeakResponse>;
export declare function harnessDeathReason(status: unknown): string;
export declare function harnessDied(status: unknown): boolean;
export declare function modelCatalogChanged(state: unknown): boolean;
export declare function heldLoadModel(state: unknown): string | null;
export declare function droppedHeldLoadModel(state: unknown): string | null;
export declare function imageDownloadProgress(state: unknown): ImageDownloadObservation | null;
