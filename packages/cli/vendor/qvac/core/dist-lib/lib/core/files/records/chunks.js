import b4a from 'b4a';
import { listChunks, updateOp } from '../../chunk.js';
import { hasLiveSource } from './routing.js';
export async function syncAttachmentChunk(mesh, chunk) {
    if (chunk.type !== 'attachment')
        return;
    const attachment = chunk.attachment;
    if (!attachment?.deletedAt || typeof attachment.blobId !== 'string') {
        return;
    }
    await tombstoneDerived(mesh, chunk, attachment.deletedAt);
    if (await hasLiveSource(mesh, chunk.chatId, attachment.blobId)) {
        return;
    }
    mesh.log?.debug('sync', 'attachment tombstone observed - reclaiming blob bytes', { id: chunk.id });
    await mesh.files.clear(attachment.blobId, chunk.id);
    await mesh.fileIndex?.markCleared(attachment.blobId);
}
async function tombstoneDerived(mesh, source, at) {
    const ours = mesh.ourDeviceId;
    if (!ours || !source.attachment) {
        return;
    }
    const batch = mesh.batch();
    for (const chunk of await listChunks(mesh, { chatId: source.chatId, type: 'attachment' })) {
        const { attachment } = chunk;
        if (chunk.sourceId !== source.attachment.id || !attachment || attachment.deletedAt) {
            continue;
        }
        if (b4a.equals(chunk.originDeviceId, ours)) {
            const tombstone = { ...attachment, deletedAt: at };
            batch.dispatch('update-chunk', updateOp(chunk, { id: chunk.id, attachment: tombstone }));
        }
    }
    await batch.flush();
}
