import { AbortedError } from '@qvac/harness/race-abort';
import { nextFrame } from '../../next-frame.js';
import { parseBlobReference } from './reference.js';
import b4a from 'b4a';
export async function* writeBlob(blobs, chunks, options = {}) {
    const ws = blobs.createWriteStream();
    const done = new Promise((resolve, reject) => {
        ws.once('close', () => resolve());
        ws.once('error', (err) => reject(err));
    });
    void done.catch(noop);
    let finished = false;
    const it = chunks[Symbol.asyncIterator]();
    try {
        let bytesWritten = 0;
        let next = await nextFrame(it, options);
        while (!next.done) {
            const chunk = next.value;
            bytesWritten += chunk.length;
            if (!ws.write(chunk)) {
                await drained(ws, done);
            }
            next = await nextFrame(it, options);
            if (next.done) {
                break;
            }
            yield { bytesWritten };
        }
        ws.end();
        await done;
        finished = true;
        yield { bytesWritten, blobId: ws.id, byteLength: bytesWritten };
    }
    finally {
        if (!finished) {
            void it.return?.().catch(noop);
            ws.end();
            const settled = await done.then(() => true, () => false);
            if (settled && ws.id.blockLength > 0) {
                await blobs.clear(ws.id).catch(noop);
            }
        }
    }
}
async function drained(ws, done) {
    const drain = Promise.withResolvers();
    const onDrain = () => drain.resolve();
    ws.once('drain', onDrain);
    try {
        await Promise.race([drain.promise, done]);
    }
    finally {
        ws.off('drain', onDrain);
    }
}
const noop = () => { };
export function stringifyBlobId(blobs, id) {
    return JSON.stringify({ ...id, coreKey: b4a.toHex(blobs.core.key) });
}
export async function* readBlob(blobs, blobId, options = {}) {
    const { signal, ...readOptions } = options;
    if (signal?.aborted) {
        throw new AbortedError();
    }
    const rs = blobs.createReadStream(blobId, readOptions);
    const abort = () => rs.destroy(new AbortedError());
    signal?.addEventListener('abort', abort, { once: true });
    let bytesRead = 0;
    try {
        for await (const chunk of rs) {
            bytesRead += chunk.length;
            yield { data: chunk, bytesRead, byteLength: blobId.byteLength };
        }
    }
    finally {
        signal?.removeEventListener('abort', abort);
        rs.destroy();
    }
}
export async function clearBlob(mesh, blobId, id) {
    try {
        const reference = parseBlobReference(blobId);
        if (reference.inline) {
            return true;
        }
        await clearBlobRef(mesh, reference);
        return true;
    }
    catch (err) {
        mesh.log?.warn('sync', 'blob clear failed', { id, err });
        return false;
    }
}
async function clearBlobRef(mesh, reference) {
    const { coreKey, blobId: id } = reference;
    if (!coreKey || coreKey === b4a.toHex(mesh.blobs.core.key)) {
        await mesh.blobs.clear(id);
        return;
    }
    const remote = await mesh.openBlobs(b4a.from(coreKey, 'hex'));
    try {
        await remote.clear(id);
    }
    finally {
        await remote.close();
    }
}
function compactable(core) {
    return 'compact' in core && typeof core.compact === 'function';
}
async function compact(core) {
    if (!compactable(core)) {
        throw new Error('this hypercore cannot compact');
    }
    await core.compact();
}
export async function compactBlobCores(mesh, coreKeys) {
    for (const key of coreKeys) {
        try {
            if (b4a.equals(key, mesh.blobs.core.key)) {
                await compact(mesh.blobs.core);
                continue;
            }
            const remote = await mesh.openBlobs(key);
            try {
                await compact(remote.core);
            }
            finally {
                await remote.close();
            }
        }
        catch (err) {
            mesh.log?.warn('sync', 'blob compaction failed', { coreKey: b4a.toHex(key), err });
        }
    }
}
