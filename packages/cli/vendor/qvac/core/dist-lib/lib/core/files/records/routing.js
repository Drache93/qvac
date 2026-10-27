import { isSupportedRagDocument } from '../rag/index.js';
import { groupAttachmentsByMessage } from './linkage.js';
import { compareBlobReferences } from '../store/index.js';
import { getChat, setChatRagEnabled } from '../../chat.js';
import { listChunks } from '../../chunk.js';
import { IMAGE_MIMES } from '../../image/normalize.js';
import { addKnowledge, listKnowledge, listKnowledgeBase, removeKnowledge } from './knowledge.js';
import b4a from 'b4a';
export function isKnowledgeRoutedAttachment(input) {
    if (IMAGE_MIMES.has(input.mimeType.toLowerCase()))
        return false;
    return isSupportedRagDocument(input);
}
export async function routeAttachmentToKnowledge(mesh, chatId, attachment) {
    const knowledge = await addKnowledge(mesh, {
        id: attachment.id,
        chatId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        byteLength: attachment.byteLength,
        blobId: attachment.blobId
    });
    try {
        const chat = await getChat(mesh, chatId);
        if (chat && !chat.deletedAt && !chat.ragEnabled) {
            await setChatRagEnabled(mesh, chatId, { ragEnabled: true });
        }
    }
    catch (err) {
        await removeKnowledge(mesh, { knowledgeId: attachment.id, at: Date.now() }).catch(noop);
        throw err;
    }
    return knowledge;
}
export async function hasLiveSource(mesh, chatId, reference) {
    const same = (blobId) => compareBlobReferences(blobId, reference, b4a.toHex(mesh.blobs.core.key)) !== false;
    const rows = chatId ? await listKnowledge(mesh, { chatId }) : await listKnowledgeBase(mesh);
    if (rows.some((row) => same(row.blobId))) {
        return true;
    }
    if (!chatId) {
        return false;
    }
    return (await listChunks(mesh, { chatId, type: 'attachment' })).some(({ attachment }) => attachment && !attachment.deletedAt && same(attachment.blobId));
}
export function attachTurnDocumentIds(chunks) {
    const attachments = [];
    const userMessages = [];
    for (const chunk of chunks) {
        if (chunk.type === 'attachment') {
            attachments.push(chunk);
        }
        else if (chunk.userMessage) {
            userMessages.push(chunk);
        }
    }
    const last = userMessages[userMessages.length - 1];
    if (!last) {
        return [];
    }
    const bound = groupAttachmentsByMessage(attachments, userMessages).get(last.id) ?? [];
    const ids = [];
    for (const chunk of bound) {
        const ref = chunk.attachment;
        if (!ref?.id || !ref.fileName || !ref.mimeType || ref.deletedAt) {
            continue;
        }
        if (isKnowledgeRoutedAttachment({ fileName: ref.fileName, mimeType: ref.mimeType })) {
            ids.push(ref.id);
        }
    }
    return ids;
}
function noop() { }
