import { liveDeviceForWriter, trackActivity } from './activity.js';
import { meshKind } from './mesh-kind.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import { CHATS, CHAT_READS, CHUNKS, CHUNKS_BY_CHAT, CHUNK_COUNTERS, INDEXING_STATUS, INDEXING_STATUS_BY_CHAT, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, KNOWLEDGE_BY_CHAT, PURGED_CHATS, TOOL_ACTIVITY, TOOL_ACTIVITY_BY_AGENT } from '../collections.js';
export async function isPurged(tx, chatId) {
    return (await tx.get(PURGED_CHATS, { chatId })) !== null;
}
export async function foreignChat(tx, chatId) {
    if (!chatId ||
        (await rulesVersion(tx)) < WORKSPACES_RULES ||
        (await meshKind(tx)) !== 'project') {
        return false;
    }
    return (await tx.get(CHATS, { id: chatId })) === null;
}
export function registerChatRoutes(router) {
    router.add('@qvac/put-chat', trackActivity(async ({ chat }, { tx, log }) => {
        const existing = await tx.get(CHATS, { id: chat.id });
        if (existing?.deletedAt && !chat.deletedAt) {
            log?.debug('contract', 'put-chat dropped: tombstone is sticky', { id: chat.id });
            return;
        }
        const readThrough = (await frozenRead(tx, existing))
            ? existing?.readThrough || undefined
            : Math.max(existing?.readThrough || 0, chat.readThrough || 0) || undefined;
        if (existing && !chat.deletedAt && (existing.updatedAt ?? 0) > (chat.updatedAt ?? 0)) {
            if (readThrough === (existing.readThrough || undefined)) {
                log?.debug('contract', 'put-chat dropped: stale updatedAt', { id: chat.id });
                return;
            }
            await tx.insert(CHATS, { ...existing, readThrough });
            log?.debug('contract', 'put-chat stale: read marker kept', { id: chat.id });
            return;
        }
        if (existing && (await isPurged(tx, chat.id))) {
            log?.debug('contract', 'put-chat dropped: chat is purged', { id: chat.id });
            return;
        }
        const row = { ...chat, readThrough };
        await tx.insert(CHATS, row);
        log?.debug('contract', existing ? 'chat updated' : 'chat created', { id: chat.id });
        return row;
    }));
    router.add('@qvac/mark-chat-read', trackActivity(markChatRead));
    router.add('@qvac/purge-chat', trackActivity(async ({ chatId, at }, { tx, log }) => {
        const chat = await tx.get(CHATS, { id: chatId });
        if (!chat?.deletedAt) {
            log?.debug('contract', 'purge-chat dropped: chat is not deleted', { chatId });
            return;
        }
        if (await isPurged(tx, chatId)) {
            return;
        }
        await purgeChat(tx, chat);
        const purged = { chatId, at: at || chat.deletedAt };
        await tx.insert(PURGED_CHATS, purged);
        log?.debug('contract', 'chat purged', { chatId });
        return purged;
    }));
}
async function frozenRead(tx, existing) {
    return !!existing && (await rulesVersion(tx)) >= WORKSPACES_RULES;
}
async function markChatRead(read, { tx, node, log }) {
    const { chatId } = read;
    const chat = await tx.get(CHATS, { id: chatId });
    if (!chat || chat.deletedAt) {
        log?.debug('contract', 'mark-chat-read dropped: no such chat', { chatId });
        return;
    }
    const memberId = (await liveDeviceForWriter(tx, node.key))?.memberId;
    if (!memberId) {
        log?.warn('contract', 'mark-chat-read dropped: the signer speaks for no member', { chatId });
        return;
    }
    const existing = await tx.get(CHAT_READS, { chatId, memberId });
    if (existing && existing.readThrough >= read.readThrough) {
        return;
    }
    const row = { chatId, memberId, readThrough: read.readThrough };
    await tx.insert(CHAT_READS, row);
    return row;
}
async function purgeChat(tx, chat) {
    const chatId = chat.id;
    const inChat = { gte: { chatId }, lte: { chatId } };
    for (const id of await idsOf(tx.find(CHUNKS_BY_CHAT, inChat))) {
        await tx.delete(CHUNKS, { id });
    }
    await tx.delete(CHUNK_COUNTERS, { chatId });
    for (const read of await tx.find(CHAT_READS, inChat).toArray()) {
        await tx.delete(CHAT_READS, { chatId, memberId: read.memberId });
    }
    for (const knowledge of await tx.find(KNOWLEDGE_BY_CHAT, inChat).toArray()) {
        const ofKnowledge = { gte: { knowledgeId: knowledge.id }, lte: { knowledgeId: knowledge.id } };
        const artifacts = tx.find(KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, ofKnowledge);
        for (const artifact of await artifacts.toArray()) {
            await tx.delete(KNOWLEDGE_ARTIFACTS, { id: artifact.id });
        }
        await tx.delete(KNOWLEDGE, { id: knowledge.id });
    }
    for (const status of await tx
        .find(INDEXING_STATUS_BY_CHAT, inChat)
        .toArray()) {
        await tx.delete(INDEXING_STATUS, { id: status.id });
    }
    const ofAgent = { gte: { agentId: chat.agentId }, lte: { agentId: chat.agentId } };
    const activity = tx.find(TOOL_ACTIVITY_BY_AGENT, ofAgent);
    for (const id of await idsOf(activity, (row) => row.chatId === chatId)) {
        await tx.delete(TOOL_ACTIVITY, { id });
    }
    const tombstone = {
        id: chatId,
        agentId: chat.agentId,
        title: '',
        createdAt: chat.createdAt,
        deletedAt: chat.deletedAt,
        updatedAt: chat.updatedAt
    };
    await tx.insert(CHATS, tombstone);
}
async function idsOf(rows, keep = () => true) {
    const ids = [];
    for await (const row of rows) {
        if (keep(row)) {
            ids.push(row.id);
        }
    }
    return ids;
}
