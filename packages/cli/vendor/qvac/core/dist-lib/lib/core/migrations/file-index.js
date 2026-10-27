import { attachmentChunks } from '../files/records/sweep.js';
const BATCH = 256;
export async function backfillFileIndex(mesh) {
    const index = mesh.fileIndex;
    if (!index) {
        return;
    }
    const snapshot = mesh.view.snapshot();
    try {
        let batch = [];
        for await (const chunk of attachmentChunks(snapshot)) {
            if (mesh.closing)
                return;
            batch.push(chunk);
            if (batch.length < BATCH) {
                continue;
            }
            await index.record(batch);
            batch = [];
        }
        if (batch.length > 0) {
            await index.record(batch);
        }
    }
    finally {
        await snapshot.close();
    }
}
