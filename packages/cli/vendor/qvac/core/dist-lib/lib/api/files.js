import { AbortController } from 'bare-abort-controller';
import { Readable } from 'streamx';
import { requireMesh } from './current-mesh.js';
import { frameReadable } from '../frame-readable.js';
export function createFilesApi(pool) {
    return {
        async filePreview(request) {
            return (await requireMesh(pool, request.meshId)).files.preview(request);
        },
        async fileRetry(request) {
            await (await requireMesh(pool, request.meshId)).files.retry(request);
            return { ok: true };
        },
        fileRead(request) {
            const abort = new AbortController();
            async function* read() {
                const mesh = await requireMesh(pool, request.meshId);
                const close = () => stream.destroy();
                mesh.files.once('close', close);
                try {
                    yield* mesh.files.fileRead(request, { signal: abort.signal });
                }
                finally {
                    mesh.files.off('close', close);
                }
            }
            const iterator = read();
            const stream = new Readable({
                read(callback) {
                    iterator
                        .next()
                        .then((frame) => {
                        stream.push(frame.done ? null : frame.value);
                        callback(null);
                    })
                        .catch(callback);
                },
                predestroy: () => abort.abort('file read closed'),
                destroy(callback) {
                    iterator
                        .return(undefined)
                        .then(() => callback(null))
                        .catch(callback);
                }
            });
            return frameReadable(stream);
        }
    };
}
