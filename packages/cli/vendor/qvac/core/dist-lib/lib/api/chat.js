import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import { createChat, deleteChat, markChatRead, mustGetActiveChatListing, renameChat, setChatKnowledgeSource, setChatProject, setChatRagEnabled, setChatSuggestion, setChatWebSearchEnabled, switchChatAgent } from '../core/chat.js';
import { CoreError } from '../errors.js';
import { accountPicks } from '../core/shared-agents.js';
import { inProject, readProject } from '../core/contract/projects.js';
import { listChatActivity } from '../core/chat-activity.js';
import { forkChat } from '../core/chat-fork.js';
import { listChatPage } from '../core/chat-order.js';
import { searchChats } from '../core/chat-search.js';
import { heldMesh, meshWatchable, requireMesh } from './current-mesh.js';
import { CHATS } from '../core/collections.js';
const SEARCH_SUPERSEDED_ABORT = 'superseded by a newer chat search';
const WORKSPACE_ROWS = { route: 'put-project' };
async function projectLink(pool, chat, { projectId, projectOf }) {
    if (!projectId) {
        return undefined;
    }
    if (chat.role !== 'public') {
        throw new CoreError('CHAT_PROJECT_LINK_NOT_PRIVATE');
    }
    const project = await heldMesh(pool, projectId);
    const ours = chat.ourMemberId ?? (await chat.refreshOurMember())?.memberId;
    if (project?.role !== 'project' || !ours || !(await inProject(project.view, ours))) {
        throw new CoreError('PROJECT_NOT_FOUND', [projectId]);
    }
    if (!(await listedIn(pool, chat, { project, projectOf }))) {
        throw new CoreError('PROJECT_NOT_FOUND', [projectId]);
    }
    return projectId;
}
async function listedIn(pool, chat, { project, projectOf }) {
    const { workspaceKey } = chat;
    if (!workspaceKey) {
        return true;
    }
    const scope = await heldMesh(pool, b4a.toHex(workspaceKey), WORKSPACE_ROWS);
    const row = scope?.role === 'workspace' ? await readProject(scope.view, project.key) : null;
    if (!row || row.deletedAt) {
        return false;
    }
    return !projectOf || (await projectOf(workspaceKey, project.key));
}
async function liveLink(chat, gone) {
    return chat.projectId && (await gone?.(chat.projectId)) ? { ...chat, projectId: undefined } : chat;
}
export function createChatApi(pool, local, { account = () => null, agents = null, deviceId, inferenceCalls = null, deletedProject = null, projectOf = null, workspaceOf = null, log }) {
    const picks = agents ?? accountPicks(account);
    const linkScope = async (meshId, projectId) => {
        const named = account();
        if (!projectId || !named || b4a.toHex(named.key) !== meshId) {
            return meshId;
        }
        return (await workspaceOf?.(projectId)) ?? meshId;
    };
    let searchAbort = null;
    const chatList = (mesh, { limit, cursor }) => listChatPage(mesh, local, { limit: limit || undefined, cursor: cursor ?? undefined }).then(async (page) => ({
        ...page,
        chats: await Promise.all(page.chats.map((chat) => liveLink(chat, deletedProject)))
    }));
    const chatActivity = (mesh, chatIds) => listChatActivity(mesh, chatIds ?? undefined).then((activities) => ({ activities }));
    return {
        createChat: async ({ meshId, agentId, config, projectId, shared }) => {
            if (shared && !projectId) {
                throw new CoreError('CHAT_SHARED_NEEDS_PROJECT');
            }
            const scope = await linkScope(meshId, projectId);
            const mesh = await requireMesh(pool, scope);
            const link = await projectLink(pool, mesh, { projectId, projectOf });
            if (shared && link) {
                const project = await requireMesh(pool, link);
                await picks.pick(project, agentId);
                const chat = await createChat(project, { agentId, title: config.title });
                return { ...chat, meshId: link };
            }
            await picks.pick(mesh, agentId);
            return {
                ...(await createChat(mesh, { agentId, title: config.title, projectId: link })),
                meshId: scope
            };
        },
        listChats: async (request) => chatList(await requireMesh(pool, request.meshId), request),
        getChat: async ({ chatId, meshId }) => {
            const mesh = await requireMesh(pool, meshId);
            return liveLink(await mustGetActiveChatListing(mesh, chatId), deletedProject);
        },
        renameChat: async ({ chatId, meshId, config }) => renameChat(await requireMesh(pool, meshId), chatId, config.title),
        setChatSuggestion: async ({ chatId, meshId, suggestion }) => setChatSuggestion(await requireMesh(pool, meshId), chatId, suggestion),
        markChatRead: async ({ chatId, meshId }) => markChatRead(await requireMesh(pool, meshId), chatId),
        setChatAgent: async ({ chatId, agentId, meshId }) => {
            if (!deviceId)
                throw new CoreError('CHAT_AGENT_SWITCH_NO_DEVICE');
            const mesh = await requireMesh(pool, meshId);
            await picks.pick(mesh, agentId);
            const before = (await mustGetActiveChatListing(mesh, chatId)).agentId;
            const set = await switchChatAgent(mesh, chatId, { deviceId, agentId });
            await picks.unpick(mesh, before);
            return set;
        },
        setChatProject: async ({ chatId, meshId, projectId }) => {
            const scope = await linkScope(meshId, projectId);
            const mesh = await requireMesh(pool, scope);
            const elsewhere = scope !== meshId && !(await mesh.view.get(CHATS, { id: chatId }));
            if (elsewhere && (await (await requireMesh(pool, meshId)).view.get(CHATS, { id: chatId }))) {
                throw new CoreError('CHAT_PROJECT_OTHER_WORKSPACE');
            }
            return setChatProject(mesh, chatId, await projectLink(pool, mesh, { projectId, projectOf }));
        },
        forkChat: async ({ meshId, targetMeshId, config, ...cut }) => {
            if (!deviceId)
                throw new CoreError('CHAT_FORK_NO_DEVICE');
            const from = await requireMesh(pool, meshId);
            const into = targetMeshId ? await requireMesh(pool, targetMeshId) : from;
            await picks.pick(into, cut.agentId);
            return forkChat({ from, into, fromId: meshId }, { ...cut, title: config?.title, originDeviceId: deviceId });
        },
        setChatRagEnabled: async ({ chatId, enabled, meshId }) => setChatRagEnabled(await requireMesh(pool, meshId), chatId, { ragEnabled: enabled ?? false }),
        setChatWebSearchEnabled: async ({ chatId, enabled, meshId }) => setChatWebSearchEnabled(await requireMesh(pool, meshId), chatId, enabled ?? false),
        setChatKnowledgeSource: async ({ chatId, meshId, source, enabled }) => setChatKnowledgeSource(await requireMesh(pool, meshId), chatId, {
            source,
            enabled: enabled ?? false
        }),
        deleteChat: async ({ chatId, meshId }) => {
            const mesh = await requireMesh(pool, meshId);
            const deleted = await deleteChat(mesh, deviceId, chatId);
            await picks.unpick(mesh, deleted.agentId);
            await inferenceCalls?.forget(chatId);
            return deleted;
        },
        chatsWatch: meshWatchable(pool, (request, store) => chatList(store, request), { name: 'chatsWatch', log, changes: local }),
        listChatActivity: async (input) => chatActivity(await requireMesh(pool, input.meshId), input.chatIds),
        chatActivityWatch: meshWatchable(pool, (request, store) => chatActivity(store, request.chatIds), { name: 'chatActivityWatch', log }),
        searchChats: async (input) => {
            searchAbort?.abort(SEARCH_SUPERSEDED_ABORT);
            const controller = new AbortController();
            searchAbort = controller;
            return {
                hits: [
                    ...(await searchChats(await requireMesh(pool, input.meshId), {
                        query: input.query,
                        limit: input.limit,
                        signal: controller.signal
                    }))
                ]
            };
        }
    };
}
