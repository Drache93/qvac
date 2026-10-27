import { toAsyncIterable } from '../core/async-iterable.js';
import { normalizeImageForModel } from '../core/image/normalize.js';
import { detectImageMime } from '../core/image/sniff.js';
import { routed } from './current-mesh.js';
import { createAgentsApi } from './agents.js';
import { AgentFolders, createAgentFoldersApi } from './agent-folders.js';
import { createApprovalRulesApi } from './approval-rules.js';
import { createAttachmentsApi } from './attachments.js';
import { createChatApi } from './chat.js';
import { createChatMoveApi } from './chat-move.js';
import { createChatGroupsApi } from './chat-groups.js';
import { createChunksApi } from './chunks.js';
import { createAppConfigApi } from './app-config.js';
import { createConfigApi } from './config.js';
import { createDevicesApi } from './devices.js';
import { createDiagnosticsApi } from './diagnostics.js';
import { createInferenceCallsApi } from './inference-calls.js';
import { createExecutionApi } from './execution.js';
import { createHostRunLogApi } from './host-run-log.js';
import { createKnowledgeApi } from './knowledge.js';
import { isMobilePlatform } from '@qvac/harness/lib/models/model-catalog.ts';
import { createFilesApi } from './files.js';
import { createLocalFilesApi } from './local-files.js';
import { createLogsApi } from './logs.js';
import { instrument } from './instrument.js';
import { watchable } from './watchable.js';
import { createMembersApi } from './members.js';
import { createMeshApi } from './mesh.js';
import { createWorkspaceApi } from './workspace.js';
import { createProjectsApi } from './projects.js';
import { createBlindPeeringApi, createNetworkApi } from './network.js';
import { createNotificationsApi } from './notifications.js';
import { createModelDownloadApi } from './model-download.js';
import { createCustomModelApi } from './custom-models.js';
import { createRagApi } from './rag.js';
import { createSyncApi } from './sync.js';
import { createToolActivityApi } from './tool-activity.js';
import { createToolConfigsApi } from './tool-configs.js';
import { effectiveCtxSize } from './effective-ctx-size.js';
import b4a from 'b4a';
export function createApi(deps = {}) {
    const mesh = deps.mesh ?? null;
    const { retryModelDownload, lifecycle, deleteChatKvCache, compactChat, pushSkillSecret, speakStream, skills, skillCatalog, listManagedSkills, readSkillFile, writeSkillFile, copySkillForEdit, deleteOverlaySkill } = deps;
    const state = deps.state ?? null;
    const log = deps.log ?? null;
    const members = mesh && deps.meshStatus ? createMembersApi(mesh, deps.meshStatus, { state, log }) : null;
    const folders = state && deps.storageRoot ? new AgentFolders(state, { storageRoot: deps.storageRoot }) : null;
    const handlers = {
        ...(state ? createConfigApi(state, log, deps.onConfigSet ?? null) : null),
        ...(state ? createAppConfigApi(state, log) : null),
        ...(state ? createModelDownloadApi(state, log) : null),
        ...(state
            ? createCustomModelApi(state, {
                preview: deps.previewModelSource ?? null,
                deleteFiles: deps.deleteModel ?? null,
                log
            })
            : null),
        ...(folders ? createAgentFoldersApi(folders) : null),
        ...(mesh
            ? createAgentsApi(routed(mesh, 'put-agent'), {
                deviceId: deps.deviceId ?? null,
                changed: deps.agentChanged ?? null,
                keepCopies: deps.agentCopiesKept ?? null,
                peers: deps.meshStatus ?? null,
                accountChanges: deps.accountAgents ?? null,
                folders,
                log
            })
            : null),
        ...(mesh && state
            ? createChatApi(routed(mesh, 'put-chat'), state, {
                account: deps.accountMesh ?? (() => null),
                agents: deps.agentPicks ?? null,
                deviceId: deps.deviceId ?? null,
                inferenceCalls: deps.inferenceCalls ?? null,
                deletedProject: deps.deletedProject ?? null,
                projectOf: deps.projectOf ?? null,
                workspaceOf: deps.workspaceOf ?? null,
                log
            })
            : null),
        ...(deps.chatMoves ? createChatMoveApi(deps.chatMoves, log) : null),
        ...(mesh ? createChatGroupsApi(routed(mesh, 'put-chat-group')) : null),
        ...(mesh ? createApprovalRulesApi(mesh) : null),
        ...(mesh
            ? createChunksApi(routed(mesh, 'append-chunk'), deps.deviceId ?? null, {
                log,
                account: deps.accountMesh,
                agents: deps.agentPicks ?? null,
                senders: deps.senders
            })
            : null),
        ...(mesh && deps.deviceId && deps.deviceHost
            ? createDevicesApi(mesh, {
                ...deps.deviceHost,
                deviceId: deps.deviceId,
                log
            })
            : null),
        ...(mesh
            ? createAttachmentsApi(routed(mesh, 'append-chunk'), { deviceId: deps.deviceId })
            : null),
        ...(mesh
            ? createKnowledgeApi(routed(mesh, 'add-knowledge'), {
                deviceId: deps.deviceId,
                mobile: () => isMobilePlatform(deps.platform?.() ?? ''),
                log
            })
            : null),
        ...(mesh ? createFilesApi(routed(mesh, 'append-chunk')) : null),
        ...(state ? createLocalFilesApi(state.files, deps.meshAlias ?? undefined) : null),
        ...(mesh
            ? createRagApi(routed(mesh, 'add-knowledge'), {
                index: deps.ragIndex ?? (() => null),
                embedder: deps.ragEmbed ?? (() => null),
                effectiveCtxSize: state
                    ? async (agent) => effectiveCtxSize(agent, {
                        appCtxSize: (await state.getAppConfigRow())?.ctxSize ?? 0,
                        platform: deps.platform?.() ?? null,
                        custom: (await state.getCustomModelRows()).find((row) => row.name === agent?.modelName) ?? null
                    })
                    : null
            })
            : null),
        ...(mesh && deps.deviceId
            ? createExecutionApi(routed(mesh, 'append-chunk'), deps.deviceId, {
                account: deps.accountMesh ?? (() => null),
                agents: deps.agentPicks ?? null,
                senders: deps.senders?.lookup,
                peers: deps.meshStatus ?? null,
                platform: deps.platform ?? null
            })
            : null),
        ...(mesh && state
            ? createHostRunLogApi(routed(mesh, 'append-chunk'), state.runLogs, deps.deviceId ?? null)
            : null),
        ...(mesh ? createSyncApi(routed(mesh, 'append-chunk'), log) : null),
        ...(mesh ? createToolConfigsApi(routed(mesh, 'put-tool-configs'), log) : null),
        ...(mesh
            ? createToolActivityApi(routed(mesh, 'append-tool-activity'), deps.deviceId ?? null, log)
            : null),
        ...(mesh && state
            ? createNotificationsApi(routed(mesh, 'append-chunk'), state, {
                deviceId: deps.deviceId,
                log
            })
            : null),
        ...members,
        ...(deps.meshStatus && members
            ? createMeshApi(deps.meshStatus, members.updateMember, log)
            : null),
        ...(mesh && deps.meshStatus ? createWorkspaceApi(mesh, deps.meshStatus, log) : null),
        ...(mesh && deps.meshStatus
            ? createProjectsApi(mesh, deps.meshStatus, {
                account: deps.accountMesh ?? (() => null),
                projectOf: deps.projectOf ?? (async () => false),
                nameOf: deps.nameOf ?? (() => null),
                log
            })
            : null),
        ...(deps.network ? createNetworkApi(deps.network, log) : null),
        ...(deps.blindPeering ? createBlindPeeringApi(deps.blindPeering, log) : null),
        ...(deps.diagnostics ? createDiagnosticsApi(deps.diagnostics, log) : null),
        ...(deps.inferenceCalls ? createInferenceCallsApi(deps.inferenceCalls) : null),
        ...(deps.logs ? createLogsApi(deps.logs) : null),
        suspend: lifecycle
            ? async () => {
                await lifecycle.suspend();
                return { ok: true };
            }
            : undefined,
        resume: lifecycle
            ? async () => {
                await lifecycle.resume();
                return { ok: true };
            }
            : undefined,
        transcodeImage,
        listModels: deps.listModels ?? undefined,
        deleteModel: deps.deleteModel ?? undefined,
        loadModel: deps.loadModel ?? undefined,
        unloadModel: deps.unloadModel ?? undefined,
        modelUsers: deps.modelUsers ?? undefined,
        clearKvCache: deps.clearKvCache ?? undefined,
        deleteChatKvCache: deleteChatKvCache
            ? ({ chatId }) => deleteChatKvCache(chatId)
            : undefined,
        compactChat: compactChat
            ? ({ chatId, meshId }) => compactChat(chatId, meshId)
            : undefined,
        modelCatalogWatch: deps.modelCatalogWatch ?? undefined,
        modelsWatch: deps.modelsWatch ?? undefined,
        retryModelDownload: retryModelDownload
            ? async (request) => {
                await retryModelDownload(request);
                return { ok: true };
            }
            : undefined,
        pushSkillSecret: pushSkillSecret
            ? async (request) => {
                await pushSkillSecret(request);
                return { ok: true };
            }
            : undefined,
        transcribe: deps.transcribe ?? undefined,
        detectLanguage: deps.detectLanguage ?? undefined,
        speak: deps.speak ?? undefined,
        speakStream: speakStream
            ? async function* (stream) {
                const text = (async function* () {
                    for await (const frame of toAsyncIterable(stream)) {
                        if (frame.text) {
                            yield frame.text;
                        }
                    }
                })();
                yield* speakStream(text);
            }
            : undefined,
        skills: skills
            ? async (req) => ({
                skills: await skills(req?.agentId, req?.modelName, {
                    refresh: req?.refresh === true,
                    meshId: req?.meshId || undefined
                })
            })
            : undefined,
        skillCatalog: skillCatalog
            ? async (req) => skillCatalog(req?.agentId, req?.modelName, { refresh: req?.refresh === true })
            : undefined,
        listManagedSkills: listManagedSkills
            ? async (req) => listManagedSkills(req?.agentId)
            : undefined,
        readSkillFile: readSkillFile
            ? async (req) => readSkillFile(req?.name, req?.agentId)
            : undefined,
        writeSkillFile: writeSkillFile
            ? async (req) => writeSkillFile(req?.name, req?.content, req?.agentId)
            : undefined,
        copySkillForEdit: copySkillForEdit
            ? async (req) => copySkillForEdit(req?.name, req?.agentId)
            : undefined,
        deleteOverlaySkill: deleteOverlaySkill
            ? async (req) => deleteOverlaySkill(req?.name, req?.agentId)
            : undefined,
        tools: deps.tools ?? undefined
    };
    return instrument(handlers, log);
}
async function transcodeImage(request) {
    const normalized = await normalizeImageForModel(request.bytes);
    if (normalized === request.bytes || detectImageMime(normalized) !== 'image/jpeg') {
        return {};
    }
    return { bytes: b4a.toBuffer(normalized) };
}
