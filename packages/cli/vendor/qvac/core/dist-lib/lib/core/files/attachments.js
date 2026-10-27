import { CoreError } from '../../errors.js';
import { linkAttachment } from '../attachment-link.js';
import { getChunk, updateChunk } from '../chunk.js';
import { uploadFile } from './upload.js';
import b4a from 'b4a';
export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
export function attachmentFiles(mesh, { maxBytes = MAX_ATTACHMENT_BYTES, deviceId = null, inactivityMs } = {}) {
    return {
        async *uploadAttachment(frames) {
            for await (const frame of uploadFile(mesh, frames, {
                kind: 'attachment',
                maxBytes,
                inactivityMs
            })) {
                yield {
                    bytesWritten: frame.bytesWritten,
                    attachment: frame.attachment
                        ? linkAttachment(mesh.attachmentUrl, frame.attachment)
                        : undefined
                };
            }
        },
        downloadAttachment: async function* ({ blobId }) {
            yield* mesh.files.read(blobId);
        },
        async deleteAttachment({ chunkId, at }) {
            if (!at || at < 0) {
                throw new Error(`delete-attachment needs a positive timestamp, got ${at}`);
            }
            const chunk = await getChunk(mesh, chunkId);
            if (!chunk) {
                throw new CoreError('CHUNK_NOT_FOUND', [chunkId]);
            }
            if (chunk.type !== 'attachment' || !chunk.attachment) {
                throw new CoreError('NOT_AN_ATTACHMENT', [chunkId]);
            }
            if (deviceId && !b4a.equals(chunk.originDeviceId, deviceId)) {
                throw new CoreError('ATTACHMENT_DELETE_NOT_ORIGIN');
            }
            const attachment = chunk.attachment;
            if (attachment.deletedAt) {
                return chunk;
            }
            const updated = await updateChunk(mesh, {
                id: chunkId,
                attachment: { ...attachment, deletedAt: at }
            });
            if (!updated.attachment?.deletedAt) {
                throw new CoreError('ATTACHMENT_DELETE_DROPPED');
            }
            return updated;
        }
    };
}
