import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { AssistantCapabilityProfile, AssistantClearModelDownloadRequest, AssistantDeleteModelRequest, AssistantDeleteModelResponse, AssistantCompactChatResponse, AssistantKvCacheDeletionResponse, AssistantListModelsRequest, AssistantLoadModelRequest, AssistantLoadModelResponse, AssistantModelCatalogRevision, AssistantCopySkillResponse, AssistantDeleteSkillResponse, AssistantManagedSkillsResponse, AssistantModelInfoList, AssistantOkResponse, AssistantPushSkillSecretRequest, AssistantSkillCatalogResponse, AssistantSkillFileResponse, AssistantSpeakRequest, AssistantSpeakResponse, AssistantToolCatalogResponse, AssistantDetectLanguageRequest, AssistantDetectLanguageResponse, AssistantTranscribeRequest, AssistantTranscribeResponse, AssistantUnloadModelRequest, AssistantUnloadModelResponse, AssistantModelUsers, AssistantModelUsersRequest } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { Mesh } from '../core/mesh.ts';
import { type MeshPool } from './current-mesh.ts';
import type { AgentPicks } from '../core/shared-agents.ts';
import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import type { ChatMoves } from '../core/chat-move.ts';
import { type ChunkSenders } from './chunks.ts';
import { type DiagnosticsSource } from './diagnostics.ts';
import { type InferenceCallReader } from './inference-calls.ts';
import { type MeshAlias } from './local-files.ts';
import { type LogSource } from './logs.ts';
import { type MeshStatusSource } from './mesh.ts';
import { type NameOf, type ProjectOf } from './projects.ts';
import { type BlindPeeringSource, type NetworkSource } from './network.ts';
import { type CustomModelPreviewSource } from './custom-models.ts';
import type { IndexingEmbedder, VectorIndex } from '../core/files/index.ts';
interface ApiDeps {
    state?: Awaited<ReturnType<typeof openLocalStore>> | null;
    mesh?: MeshPool | null;
    meshAlias?: MeshAlias | null;
    meshStatus?: MeshStatusSource | null;
    accountMesh?: (() => Mesh | null) | null;
    agentChanged?: ((agentId: string) => Promise<void>) | null;
    agentCopiesKept?: ((agent: QvacAgent) => Promise<void>) | null;
    agentPicks?: AgentPicks | null;
    accountAgents?: {
        watch(listener: () => void): void;
        unwatch(listener: () => void): void;
    } | null;
    network?: NetworkSource | null;
    blindPeering?: BlindPeeringSource | null;
    diagnostics?: DiagnosticsSource | null;
    inferenceCalls?: InferenceCallReader | null;
    chatMoves?: ChatMoves | null;
    senders?: ChunkSenders | null;
    logs?: LogSource | null;
    log?: LoggerInterface | null;
    deviceId?: Buffer | null;
    lifecycle?: {
        suspend(): Promise<void>;
        resume(): Promise<void>;
    } | null;
    listModels?: ((options: AssistantListModelsRequest) => Promise<AssistantModelInfoList>) | null;
    deleteModel?: ((options: AssistantDeleteModelRequest) => Promise<AssistantDeleteModelResponse>) | null;
    loadModel?: ((request: AssistantLoadModelRequest) => Promise<AssistantLoadModelResponse>) | null;
    unloadModel?: ((request: AssistantUnloadModelRequest) => Promise<AssistantUnloadModelResponse>) | null;
    modelUsers?: ((request: AssistantModelUsersRequest) => Promise<AssistantModelUsers>) | null;
    clearKvCache?: (() => Promise<AssistantKvCacheDeletionResponse>) | null;
    deleteChatKvCache?: ((chatId: string) => Promise<AssistantKvCacheDeletionResponse>) | null;
    compactChat?: ((chatId: string, meshId: string) => Promise<AssistantCompactChatResponse>) | null;
    modelCatalogWatch?: (() => AsyncIterable<AssistantModelCatalogRevision>) | null;
    modelsWatch?: ((request: AssistantListModelsRequest) => AsyncIterable<AssistantModelInfoList>) | null;
    retryModelDownload?: ((request: AssistantClearModelDownloadRequest) => Promise<void>) | null;
    transcribe?: ((request: AssistantTranscribeRequest) => Promise<AssistantTranscribeResponse>) | null;
    detectLanguage?: ((request: AssistantDetectLanguageRequest) => Promise<AssistantDetectLanguageResponse>) | null;
    previewModelSource?: CustomModelPreviewSource | null;
    speak?: ((request: AssistantSpeakRequest) => Promise<AssistantSpeakResponse>) | null;
    speakStream?: ((text: AsyncIterable<string>) => AsyncIterable<AssistantSpeakResponse>) | null;
    deviceHost?: {
        removeWriter: (writerKey: Buffer, deviceId: Buffer, mesh: Mesh) => Promise<void>;
        renameLocal: (name: string) => Promise<void>;
        saveProfileLocal: (capabilityProfile: AssistantCapabilityProfile, recommendedModelName: string, platform?: string) => Promise<void>;
        readLocalProfile: () => {
            capabilityProfile: AssistantCapabilityProfile;
            recommendedModelName: string;
            platform?: string;
        } | null;
        isAccount: (mesh: Mesh) => boolean;
    } | null;
    ragIndex?: ((meshId: string) => VectorIndex | null) | null;
    ragEmbed?: ((meshId: string) => IndexingEmbedder | null) | null;
    platform?: (() => string | null) | null;
    deletedProject?: ((projectId: string) => Promise<boolean>) | null;
    projectOf?: ProjectOf | null;
    nameOf?: NameOf | null;
    workspaceOf?: ((projectId: string) => Promise<string | null>) | null;
    pushSkillSecret?: ((request: AssistantPushSkillSecretRequest) => Promise<void>) | null;
    onConfigSet?: ((key: string) => void) | null;
    storageRoot?: string | null;
    skills?: ((agentId?: string | null, modelName?: string | null, options?: SkillOptions) => Promise<unknown>) | null;
    skillCatalog?: ((agentId?: string | null, modelName?: string | null, options?: {
        readonly refresh?: boolean;
    }) => Promise<AssistantSkillCatalogResponse>) | null;
    tools?: (() => Promise<AssistantToolCatalogResponse>) | null;
    listManagedSkills?: ((agentId?: string | null) => Promise<AssistantManagedSkillsResponse>) | null;
    readSkillFile?: ((name: string, agentId?: string | null) => Promise<AssistantSkillFileResponse>) | null;
    writeSkillFile?: ((name: string, content: string, agentId?: string | null) => Promise<AssistantOkResponse>) | null;
    copySkillForEdit?: ((name: string, agentId?: string | null) => Promise<AssistantCopySkillResponse>) | null;
    deleteOverlaySkill?: ((name: string, agentId?: string | null) => Promise<AssistantDeleteSkillResponse>) | null;
}
export type { Capabilities, WatchStream } from '../../spec/capabilities.d.ts';
export interface SkillOptions {
    readonly refresh?: boolean;
    readonly meshId?: string;
}
export declare function createApi(deps?: ApiDeps): Partial<CapabilityHandlers>;
