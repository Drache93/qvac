import { CoreError } from '../errors.js';
import { openUpload } from './upload-frames.js';
import { requireMesh } from './current-mesh.js';
export { MAX_ATTACHMENT_BYTES } from '../core/files/attachments.js';
export function createAttachmentsApi(pool, options = {}) {
    return {
        async *uploadAttachment(frames) {
            const upload = await openUpload(frames);
            if (!upload) {
                return;
            }
            if (!upload.first.meshId) {
                throw new CoreError('UPLOAD_MESH_MISSING');
            }
            const mesh = await requireMesh(pool, upload.first.meshId);
            yield* mesh.files.attachments(options).uploadAttachment(upload.rest);
        },
        async *downloadAttachment(request) {
            yield* (await requireMesh(pool, request.meshId)).files
                .attachments(options)
                .downloadAttachment(request);
        },
        async deleteAttachment(request) {
            return (await requireMesh(pool, request.meshId)).files
                .attachments(options)
                .deleteAttachment(request);
        }
    };
}
