import { mediaKindOrdinal } from '../../../../schema/media-kind.js';
import { ATTACHMENTS_BY_MEDIA_KIND, CHATS, CHUNKS, KNOWLEDGE } from '../../collections.js';
import { findChunksOfType } from '../../chunk.js';
export function attachmentRecord(chunk) {
    const file = chunk.attachment;
    if (chunk.type !== 'attachment' || !file) {
        return null;
    }
    return {
        ...file,
        chatId: chunk.chatId,
        updatedAt: file.createdAt,
        kind: 'attachment',
        originDeviceId: chunk.originDeviceId,
        preview: !!chunk.display &&
            typeof chunk.display === 'object' &&
            'preview' in chunk.display &&
            chunk.display.preview === true
    };
}
export async function fileRecord(view, id, input) {
    if (input === 'knowledge') {
        const row = await view.get(KNOWLEDGE, { id });
        return row && { ...row, kind: input };
    }
    const chunk = await view.get(CHUNKS, { id });
    return chunk && attachmentRecord(chunk);
}
export async function fileIds(view, input, mediaKind) {
    if (input === 'knowledge') {
        return (await view.find(KNOWLEDGE).toArray()).map((row) => row.id);
    }
    const ids = [];
    const chunks = mediaKind
        ? view.find(ATTACHMENTS_BY_MEDIA_KIND, {
            gte: { mediaKind: mediaKindOrdinal(mediaKind) },
            lte: { mediaKind: mediaKindOrdinal(mediaKind) }
        })
        : view.find(CHUNKS);
    for await (const chunk of chunks) {
        if (chunk.type === 'attachment' && chunk.id === chunk.attachment?.id) {
            ids.push(chunk.id);
        }
    }
    return ids;
}
export async function claimSource(view, id) {
    const knowledge = await fileRecord(view, id, 'knowledge');
    if (knowledge) {
        return knowledge.deletedAt ? null : knowledge;
    }
    const file = await fileRecord(view, id, 'attachment');
    return file?.id === id && file.preview && !file.deletedAt ? file : null;
}
export async function scopedFile(view, { chatId, fileId }) {
    const chat = await view.get(CHATS, { id: chatId });
    if (chat?.deletedAt) {
        return null;
    }
    const direct = await view.get(CHUNKS, { id: fileId });
    if (direct?.chatId === chatId && direct.attachment?.id === fileId) {
        return direct.attachment.deletedAt ? null : attachmentRecord(direct);
    }
    const row = await fileRecord(view, fileId, 'knowledge');
    if (row) {
        return row.chatId === chatId && !row.deletedAt ? row : null;
    }
    for (const chunk of await findChunksOfType(view, { chatId, type: 'attachment' })) {
        if (chunk.attachment?.id === fileId) {
            return chunk.attachment.deletedAt ? null : attachmentRecord(chunk);
        }
    }
    return null;
}
