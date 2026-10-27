import { CoreError } from '../errors.js';
import { mustGetActiveAgent } from './agent.js';
import { listChatGroupsIn, mustGetActiveChatGroup } from './chat-group.js';
import { appendChunk, listChunks, updateOp } from './chunk.js';
import { randomId } from './id.js';
import { assertRemovableAt } from './files/index.js';
import { chatReferences, reclaimReferences } from './files/records/purge.js';
import { place } from './rank.js';
import { chatSortKey } from './chat-order.js';
import { ownReadThrough, ownReads } from './chat-read.js';
import b4a from 'b4a';
import { ACTIVE_CHATS, ACTIVE_CHATS_BY_AGENT, ACTIVE_CHAT_GROUPS, CHATS, CHAT_GROUPS, CHUNK_COUNTERS } from './collections.js';
export const TERMINAL_RUN_STATES = new Set(['completed', 'failed', 'canceled']);
function byChatOrder(a, b) {
    return chatSortKey(a) - chatSortKey(b) || (a.id < b.id ? -1 : 1);
}
export async function liveGroupIds(snap) {
    const groups = await snap.find(ACTIVE_CHAT_GROUPS).toArray();
    return new Set(groups.map((group) => group.id));
}
export async function lastActivity(snap) {
    const counters = await snap.find(CHUNK_COUNTERS).toArray();
    return new Map(counters.map((counter) => [counter.chatId, counter.lastActivityAt ?? 0]));
}
function listingOf(chat, opts) {
    return {
        ...chat,
        groupId: opts.inLiveGroup ? chat.groupId : undefined,
        lastActivityAt: opts.activityAt || chat.createdAt,
        readThrough: opts.readThrough
    };
}
export async function enrichChat(store, chat) {
    const snap = store.view.snapshot();
    try {
        return await enrichIn(snap, chat, store.ourMemberId);
    }
    finally {
        await snap.close();
    }
}
export async function enrichIn(snap, chat, memberId) {
    const [group, counter, readThrough] = await Promise.all([
        chat.groupId
            ? snap.get(CHAT_GROUPS, { id: chat.groupId })
            : Promise.resolve(null),
        snap.get(CHUNK_COUNTERS, { chatId: chat.id }),
        ownReadThrough(snap, chat, memberId)
    ]);
    return listingOf(chat, {
        inLiveGroup: !!group && !group?.deletedAt,
        activityAt: counter?.lastActivityAt,
        readThrough
    });
}
export function enrichAll(chats, { activity, liveGroups, reads }) {
    return chats.map((chat) => listingOf(chat, {
        inLiveGroup: Boolean(chat.groupId && liveGroups.has(chat.groupId)),
        activityAt: activity.get(chat.id),
        readThrough: reads.get(chat.id)
    }));
}
export async function listSidebar(store) {
    const snap = store.view.snapshot();
    try {
        return await listSidebarIn(snap, store.ourMemberId);
    }
    finally {
        await snap.close();
    }
}
export async function listSidebarIn(snap, memberId) {
    const chats = await snap.find(ACTIVE_CHATS).toArray();
    const [activity, groups, reads] = await Promise.all([
        lastActivity(snap),
        listChatGroupsIn(snap),
        ownReads(snap, chats, memberId)
    ]);
    const liveGroups = new Set(groups.map((group) => group.id));
    return { chats: enrichAll(chats, { activity, liveGroups, reads }).sort(byChatOrder), groups };
}
export async function listChats(store) {
    return (await listSidebar(store)).chats;
}
export async function getChat(store, id) {
    const snap = store.view.snapshot();
    try {
        const chat = await snap.get(CHATS, { id });
        return chat;
    }
    finally {
        await snap.close();
    }
}
export async function mustGetChat(store, id) {
    const chat = await getChat(store, id);
    if (!chat) {
        throw new CoreError('CHAT_NOT_FOUND', [id]);
    }
    return chat;
}
export async function mustGetActiveChat(store, id) {
    const chat = await mustGetChat(store, id);
    if (chat.deletedAt) {
        throw new CoreError('CHAT_NOT_FOUND', [id]);
    }
    return chat;
}
export async function mustGetActiveChatListing(store, id) {
    return enrichChat(store, await mustGetActiveChat(store, id));
}
export function buildChat(input) {
    const now = Date.now();
    return {
        id: randomId(),
        agentId: input.agentId,
        title: input.title,
        ragEnabled: false,
        webSearchEnabled: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined,
        projectId: input.projectId
    };
}
export async function createChat(store, input) {
    const chat = buildChat(input);
    await store.dispatch('put-chat', { chat });
    return listingOf(chat, { inLiveGroup: false });
}
async function patchChat(store, id, patch) {
    return patchChatRow(store, await mustGetActiveChat(store, id), patch);
}
async function patchChatRow(store, current, patch) {
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await store.dispatch('put-chat', { chat: updated });
    return enrichChat(store, updated);
}
export function renameChat(store, id, title) {
    return patchChat(store, id, { title });
}
export function setChatSuggestion(store, id, suggestion) {
    return patchChat(store, id, { suggestion });
}
export function setChatProject(store, id, projectId) {
    return patchChat(store, id, { projectId });
}
export async function setChatAgent(store, id, agentId) {
    await mustGetActiveAgent(store, agentId);
    return patchChat(store, id, { agentId });
}
export const AGENT_SWITCHED = 'agent-switched';
export async function switchChatAgent(store, id, { deviceId, agentId }) {
    const agent = await mustGetActiveAgent(store, agentId);
    const current = await mustGetActiveChat(store, id);
    if (current.agentId === agentId) {
        return enrichChat(store, current);
    }
    const switched = { ...current, agentId, updatedAt: Date.now() };
    const batch = store.batch();
    await appendChunk(store, {
        chatId: id,
        type: 'agent-switch',
        originDeviceId: deviceId,
        agentSwitch: { agentId, name: agent.name }
    }, batch);
    batch.dispatch('put-chat', { chat: switched });
    await batch.flush();
    await cancelActiveRuns(store, id, {
        deviceId,
        agentId: current.agentId,
        reason: AGENT_SWITCHED,
        queuedOnly: true
    });
    await denyPendingApprovals(store, id);
    return enrichChat(store, switched);
}
async function denyPendingApprovals(store, chatId) {
    const batch = store.batch();
    for (const ask of await listChunks(store, { chatId, type: 'approval-request' })) {
        if (ask.approvalRequest?.status === 'pending') {
            batch.dispatch('resolve-approval', { id: ask.id, approved: false, resolvedAt: Date.now() });
        }
    }
    await batch.flush();
}
export function setChatRagEnabled(store, id, opts) {
    return patchChat(store, id, { ragEnabled: opts.ragEnabled });
}
export async function setChatKnowledgeSource(store, id, { source, enabled }) {
    const current = await mustGetActiveChat(store, id);
    const off = new Set(current.knowledgeSourcesOff ?? []);
    if (enabled) {
        off.delete(source);
    }
    else {
        off.add(source);
    }
    return patchChatRow(store, current, { knowledgeSourcesOff: [...off] });
}
export async function setChatGroup(store, id, groupId) {
    const target = groupId || undefined;
    if (target) {
        await mustGetActiveChatGroup(store, target);
    }
    const current = await mustGetActiveChat(store, id);
    const kept = (current.groupId || undefined) === target;
    return patchChatRow(store, current, kept ? { groupId: target } : { groupId: target, rank: undefined, rankedAt: undefined });
}
export async function moveChat(store, id, { groupId, afterId }) {
    const target = groupId || undefined;
    const anchor = afterId || undefined;
    if (anchor === id) {
        throw new CoreError('CHAT_ANCHOR_SELF', [id]);
    }
    const now = Date.now();
    const snap = store.view.snapshot();
    let moved;
    let placement;
    let respaced;
    try {
        if (target) {
            const group = await snap.get(CHAT_GROUPS, { id: target });
            if (!group || group.deletedAt) {
                throw new CoreError('CHAT_GROUP_NOT_FOUND', [target]);
            }
        }
        const { chats } = await listSidebarIn(snap, store.ourMemberId);
        const me = chats.find((chat) => chat.id === id);
        if (!me) {
            throw new CoreError('CHAT_NOT_FOUND', [id]);
        }
        const { lastActivityAt, ...listed } = me;
        const stored = await snap.get(CHATS, { id });
        moved = { chat: { ...listed, readThrough: stored?.readThrough }, lastActivityAt };
        const siblings = chats
            .filter((sibling) => sibling.id !== id && (sibling.groupId || undefined) === target)
            .reverse();
        let at = -1;
        if (anchor) {
            at = siblings.findIndex((sibling) => sibling.id === anchor);
            if (at === -1) {
                throw new CoreError('CHAT_ANCHOR_MISPLACED', [anchor, target]);
            }
        }
        placement = place(siblings, chatSortKey, { at, now });
        respaced = await Promise.all(placement.respaced.map(async ({ row, rank }) => ({
            chat: (await snap.get(CHATS, { id: row.id })) ?? row,
            lastActivityAt: row.lastActivityAt,
            rank
        })));
    }
    finally {
        await snap.close();
    }
    const stamp = (chat, lastActivityAt, rank) => ({
        ...chat,
        rank,
        rankedAt: Math.max(now, lastActivityAt),
        updatedAt: Math.max(now, chat.updatedAt ?? 0)
    });
    const batch = store.batch();
    for (const { chat, lastActivityAt, rank } of respaced) {
        batch.dispatch('put-chat', { chat: stamp(chat, lastActivityAt, rank) });
    }
    batch.dispatch('put-chat', {
        chat: { ...stamp(moved.chat, moved.lastActivityAt, placement.rank), groupId: target }
    });
    await batch.flush();
    return enrichChat(store, await mustGetActiveChat(store, id));
}
export function setChatWebSearchEnabled(store, id, webSearchEnabled) {
    return patchChat(store, id, { webSearchEnabled });
}
export async function markChatRead(store, id) {
    const chat = await mustGetActiveChat(store, id);
    const memberId = store.ourMemberId;
    const snap = store.view.snapshot();
    let listing;
    let count = 0;
    try {
        listing = await enrichIn(snap, chat, memberId);
        count = (await snap.get(CHUNK_COUNTERS, { chatId: id }))?.count ?? 0;
    }
    finally {
        await snap.close();
    }
    if (!memberId || count <= (listing.readThrough || 0)) {
        return listing;
    }
    await store.dispatch('mark-chat-read', { chatId: id, memberId, readThrough: count });
    return { ...listing, readThrough: count };
}
export async function cancelActiveRuns(store, chatId, { deviceId, reason, agentId, queuedOnly = false }) {
    const statuses = await listChunks(store, { chatId, type: 'run-status' });
    const skipped = (state) => TERMINAL_RUN_STATES.has(state) || (queuedOnly && state === 'executing');
    const kept = new Set(statuses.filter((c) => skipped(c.runStatus?.state ?? '')).map((c) => c.runId));
    const requests = await listChunks(store, { chatId, type: 'run-request' });
    const asked = agentId ? requests.filter((c) => c.runRequest?.agentId === agentId) : requests;
    const runIds = new Set(asked.map((c) => c.runId).filter((id) => Boolean(id)));
    const canceled = [];
    const batch = store.batch();
    for (const runId of runIds) {
        if (kept.has(runId))
            continue;
        canceled.push(runId);
        await appendChunk(store, {
            chatId,
            runId,
            type: 'run-status',
            runStatus: { state: 'canceled', reason },
            originDeviceId: deviceId
        }, batch);
    }
    await batch.flush();
    return canceled;
}
export async function removeChatKnowledge(store, chatId, at) {
    assertRemovableAt(at);
    const batch = store.batch();
    for (const row of await store.files.listKnowledge(chatId)) {
        batch.dispatch('remove-knowledge', { knowledgeId: row.id, at });
    }
    await batch.flush();
}
export async function removeChatAttachments(store, chatId, { deviceId, at }) {
    const batch = store.batch();
    for (const chunk of await listChunks(store, { chatId, type: 'attachment' })) {
        const attachment = chunk.attachment;
        if (!attachment || attachment.deletedAt) {
            continue;
        }
        if (!b4a.equals(chunk.originDeviceId, deviceId)) {
            continue;
        }
        const tombstone = { ...attachment, deletedAt: at };
        batch.dispatch('update-chunk', updateOp(chunk, { id: chunk.id, attachment: tombstone }));
    }
    await batch.flush();
}
export async function deleteChat(store, deviceId, id) {
    const current = await mustGetChat(store, id);
    const references = await chatReferences(store, id);
    const now = Date.now();
    if (deviceId) {
        await cancelActiveRuns(store, id, { deviceId });
    }
    const deleted = { ...current, deletedAt: now, updatedAt: now };
    const listing = await enrichChat(store, deleted);
    const batch = store.batch();
    batch.dispatch('put-chat', { chat: deleted });
    batch.dispatch('purge-chat', { chatId: id, at: now });
    await batch.flush();
    await reclaimReferences(store, references).catch((err) => store.log?.warn('sync', "reclaiming a deleted chat's files failed", { id, err }));
    return listing;
}
export function softDeleteChatsForAgent(store, deviceId, agentId) {
    return eachChatOfAgent(store, agentId, (chatId) => deleteChat(store, deviceId, chatId));
}
export const AGENT_DELETED = 'agent-deleted';
export function cancelRunsForAgent(store, deviceId, agentId) {
    return eachChatOfAgent(store, agentId, (chatId) => cancelActiveRuns(store, chatId, { deviceId, agentId, reason: AGENT_DELETED }));
}
async function eachChatOfAgent(store, agentId, fn) {
    const snap = store.view.snapshot();
    try {
        for await (const chat of snap.find(ACTIVE_CHATS_BY_AGENT, {
            gte: { agentId },
            lte: { agentId }
        })) {
            if (store.closing)
                return;
            await fn(chat.id);
        }
    }
    finally {
        await snap.close();
    }
}
