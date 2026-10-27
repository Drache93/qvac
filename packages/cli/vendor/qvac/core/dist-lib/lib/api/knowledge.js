import { meshWatchable, requireMesh } from './current-mesh.js';
import { watchable } from './watchable.js';
import { CoreError } from '../errors.js';
import { openUpload } from './upload-frames.js';
import { setKnowledgeCap } from '../core/files/knowledge.js';
import { mustGetKnowledge } from '../core/files/records/index.js';
export { MAX_KNOWLEDGE_BYTES } from '../core/files/knowledge.js';
export function createKnowledgeApi(pool, options) {
    const { log } = options;
    return {
        async *uploadKnowledge(frames) {
            const upload = await openUpload(frames);
            if (!upload) {
                return;
            }
            if (!upload.first.meshId) {
                throw new CoreError('UPLOAD_MESH_MISSING');
            }
            const mesh = await requireMesh(pool, upload.first.meshId);
            yield* mesh.files.knowledge(options).uploadKnowledge(upload.rest);
        },
        async *downloadKnowledge(request) {
            yield* (await requireMesh(pool, request.meshId)).files
                .knowledge(options)
                .downloadKnowledge(request);
        },
        async removeKnowledge(request) {
            return (await requireMesh(pool, request.meshId)).files
                .knowledge(options)
                .removeKnowledge(request);
        },
        async listKnowledge(request) {
            return (await requireMesh(pool, request.meshId)).files
                .knowledge(options)
                .listKnowledge(request);
        },
        async listIndexing(request) {
            return (await requireMesh(pool, request.meshId)).files
                .knowledge(options)
                .listIndexing(request);
        },
        knowledgeWatch: meshWatchable(pool, async (request, mesh) => mesh.files.knowledge(options).listKnowledge(request), { name: 'knowledgeWatch', log }),
        indexingWatch: watchable(async (request) => (await requireMesh(pool, request.meshId)).files, ({ chatId }, files) => files.listIndexing(chatId), { name: 'indexingWatch', log }),
        fileStatusWatch: watchable(async (request) => (await requireMesh(pool, request.meshId)).files, ({ chatId }, files) => files.status(chatId), { name: 'fileStatusWatch', log }),
        indexingProgressWatch: watchable(async (request) => (await requireMesh(pool, request.meshId)).files, ({ chatId }, files) => Promise.resolve({ entries: files.progress(chatId) }), { name: 'indexingProgressWatch', log }),
        async listKnowledgeBase(request) {
            return (await requireMesh(pool, request.meshId)).files.knowledgeBase();
        },
        knowledgeBaseWatch: watchable(async (request) => (await requireMesh(pool, request.meshId)).files, (_request, files) => files.knowledgeBase(), { name: 'knowledgeBaseWatch', log }),
        async fileKnowledge({ meshId, ...request }) {
            return (await requireMesh(pool, meshId)).files.knowledge(options).fileKnowledge(request);
        },
        async setKnowledgeCap({ meshId, bytes }) {
            await setKnowledgeCap(await requireMesh(pool, meshId, { route: 'set-knowledge-cap' }), bytes);
            return { ok: true };
        },
        async getKnowledge({ meshId, knowledgeId }) {
            return mustGetKnowledge(await requireMesh(pool, meshId), knowledgeId);
        }
    };
}
