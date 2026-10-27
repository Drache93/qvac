import { findChunksOfType } from '../../chunk.js';
import { CHUNK_COUNTERS, KNOWLEDGE, KNOWLEDGE_ARTIFACTS } from '../../collections.js';
export async function referencedBlobs(mesh) {
    const references = [];
    const snapshot = mesh.view.snapshot();
    try {
        for await (const chunk of attachmentChunks(snapshot)) {
            if (mesh.closing)
                return references;
            if (chunk.attachment) {
                references.push(chunk.attachment.blobId);
            }
        }
        for await (const row of snapshot.find(KNOWLEDGE)) {
            if (mesh.closing)
                return references;
            references.push(row.blobId);
        }
        for await (const row of snapshot.find(KNOWLEDGE_ARTIFACTS)) {
            if (mesh.closing)
                return references;
            references.push(row.artifactBlobId);
        }
    }
    finally {
        await snapshot.close();
    }
    return references;
}
export async function* attachmentChunks(snapshot) {
    for await (const { chatId } of snapshot.find(CHUNK_COUNTERS)) {
        yield* await findChunksOfType(snapshot, { chatId, type: 'attachment' });
    }
}
