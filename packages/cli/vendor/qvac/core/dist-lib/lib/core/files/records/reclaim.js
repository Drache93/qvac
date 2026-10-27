import { hasLiveSource } from './routing.js';
import { removeChatAttachments, removeChatKnowledge } from '../../chat.js';
import { listChunks } from '../../chunk.js';
import { getKnowledge, listKnowledgeArtifactsByKnowledge } from './knowledge.js';
import { CHATS, KNOWLEDGE, PURGED_CHATS } from '../../collections.js';
export async function syncKnowledgeTombstone(mesh, row) {
    if (!row.deletedAt)
        return;
    mesh.log?.debug('sync', 'knowledge tombstone observed - reclaiming blob bytes', { id: row.id });
    if (typeof row.blobId === 'string' && !(await hasLiveSource(mesh, row.chatId, row.blobId))) {
        await mesh.files.clear(row.blobId, row.id);
        await mesh.fileIndex?.markCleared(row.blobId);
    }
    for (const artifact of await listKnowledgeArtifactsByKnowledge(mesh, { knowledgeId: row.id })) {
        if (mesh.closing)
            return;
        await mesh.files.clear(artifact.artifactBlobId, artifact.id);
    }
}
export async function syncArtifactArrival(mesh, row) {
    const knowledge = await getKnowledge(mesh, row.knowledgeId);
    if (!knowledge?.deletedAt) {
        return;
    }
    await mesh.files.clear(row.artifactBlobId, row.id);
}
export async function sweepTombstonedBlobs(mesh, deviceId = null) {
    const held = (await mesh.fileIndex?.list()) ?? [];
    const chatIds = new Set(held.map((row) => row.chatId).filter((id) => !!id));
    for (const chatId of chatIds) {
        if (mesh.closing)
            return;
        if (deviceId && mesh.writable) {
            await recascadeTombstonedChat(mesh, chatId, deviceId);
        }
        await mesh.files.syncAttachments(await listChunks(mesh, { chatId, type: 'attachment' }));
    }
    const snap = mesh.view.snapshot();
    try {
        for await (const row of snap.find(KNOWLEDGE)) {
            if (mesh.closing)
                return;
            await syncKnowledgeTombstone(mesh, row);
        }
    }
    finally {
        await snap.close();
    }
}
async function recascadeTombstonedChat(mesh, chatId, deviceId) {
    const chat = await mesh.view.get(CHATS, { id: chatId });
    if (!chat?.deletedAt || (await mesh.view.get(PURGED_CHATS, { chatId }))) {
        return;
    }
    try {
        await removeChatAttachments(mesh, chatId, { deviceId, at: chat.deletedAt });
        await removeChatKnowledge(mesh, chatId, chat.deletedAt);
    }
    catch (error) {
        mesh.log?.warn('sync', 'chat-tombstone sweep failed - continuing with local reclaims', {
            error
        });
    }
}
