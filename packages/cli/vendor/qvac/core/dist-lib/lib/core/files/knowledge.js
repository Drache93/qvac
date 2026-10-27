import { addKnowledge, assertKnowledgeRoom, hasLiveSource, listKnowledge, removeKnowledge } from './records/index.js';
import { MAX_KNOWLEDGE_BYTES, isSupportedRagDocument } from './rag/index.js';
import { requireChatIn } from '../chunk.js';
import { randomId } from '../id.js';
import { CoreError } from '../../errors.js';
import { uploadFile } from './upload.js';
import { KNOWLEDGE_CAP_ROW } from '../contract/knowledge.js';
import { KNOWLEDGE_CAPS } from '../collections.js';
export { MAX_KNOWLEDGE_BYTES };
export function knowledgeFiles(mesh, { maxBytes = MAX_KNOWLEDGE_BYTES, inactivityMs, deviceId, mobile } = {}) {
    const list = async ({ chatId }) => ({
        knowledge: await listKnowledge(mesh, { chatId })
    });
    const indexingList = async ({ chatId }) => mesh.files.listIndexing(chatId);
    return {
        async *uploadKnowledge(frames) {
            for await (const frame of uploadFile(mesh, frames, {
                kind: 'knowledge',
                maxBytes,
                deviceId,
                inactivityMs
            })) {
                yield {
                    bytesWritten: frame.bytesWritten,
                    knowledge: 'knowledge' in frame ? frame.knowledge : undefined
                };
            }
        },
        downloadKnowledge: async function* ({ blobId }) {
            let fetched = false;
            try {
                for await (const frame of mesh.files.read(blobId)) {
                    fetched = true;
                    yield frame;
                }
            }
            finally {
                if (fetched && mobile?.() && (await hasLiveSource(mesh, null, blobId))) {
                    await mesh.files.clearFetched(blobId, blobId);
                }
            }
        },
        listKnowledge: list,
        listIndexing: indexingList,
        removeKnowledge: async ({ knowledgeId, at }) => removeKnowledge(mesh, { knowledgeId, at }),
        fileKnowledge: (request) => fileKnowledge(mesh, request)
    };
}
async function fileKnowledge(mesh, { chatId, fileId }) {
    if (mesh.role !== 'project') {
        throw new CoreError('KNOWLEDGE_BASE_NOT_A_PROJECT');
    }
    await requireChatIn(mesh, chatId);
    const file = await mesh.files.resolve({ chatId, fileId });
    if (!file) {
        throw new CoreError('KNOWLEDGE_NOT_FOUND', [fileId]);
    }
    if (!isSupportedRagDocument(file)) {
        throw new CoreError('KNOWLEDGE_TYPE_UNSUPPORTED', [file.fileName]);
    }
    await assertKnowledgeRoom(mesh, file.byteLength);
    const blobId = await copyBlob(mesh, file.blobId);
    const id = randomId();
    const { fileName, mimeType, byteLength } = file;
    try {
        return await addKnowledge(mesh, { id, fileName, mimeType, byteLength, blobId });
    }
    catch (error) {
        await mesh.files.clear(blobId, id).catch(noop);
        throw error;
    }
}
async function copyBlob(mesh, source) {
    let blobId = null;
    for await (const frame of mesh.files.write(bytesOf(mesh.files.read(source, { wait: false })))) {
        if ('blobId' in frame) {
            blobId = mesh.files.reference(frame.blobId);
        }
    }
    if (blobId === null) {
        throw new Error('blob write ended without its blobId frame');
    }
    return blobId;
}
function noop() { }
async function* bytesOf(frames) {
    for await (const { data } of frames) {
        yield data;
    }
}
export async function setKnowledgeCap(mesh, bytes) {
    if (mesh.role !== 'project') {
        throw new CoreError('KNOWLEDGE_BASE_NOT_A_PROJECT');
    }
    if (bytes < 1) {
        throw new CoreError('KNOWLEDGE_CAP_INVALID');
    }
    const current = await mesh.view.get(KNOWLEDGE_CAPS, { id: KNOWLEDGE_CAP_ROW });
    await mesh.dispatch('set-knowledge-cap', {
        bytes,
        setAt: Math.max(Date.now(), (current?.setAt ?? 0) + 1)
    });
}
