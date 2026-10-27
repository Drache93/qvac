import { pipeline, Transform } from 'streamx';
import { frameReadable } from '../frame-readable.js';
import { snapshotEquals } from './watchable.js';
export function chunkDelta(prev, next) {
    const count = next.length;
    if (prev === null) {
        return { reset: true, chunks: [...next], removed: [], count };
    }
    const upserts = next.filter((chunk) => !snapshotEquals(chunk, prev.get(chunk.id)));
    const kept = new Set(next.map((chunk) => chunk.id));
    const removed = [...prev.keys()].filter((id) => !kept.has(id));
    if (upserts.length + removed.length > count / 2) {
        return { reset: true, chunks: [...next], removed: [], count };
    }
    return { reset: false, chunks: upserts, removed, count };
}
export function chunkDeltaStream(lists) {
    let prev = null;
    const deltas = new Transform({
        transform(list, cb) {
            const next = list.chunks ?? [];
            const delta = chunkDelta(prev, next);
            prev = new Map(next.map((chunk) => [chunk.id, chunk]));
            if (!delta.reset && delta.chunks?.length === 0 && delta.removed?.length === 0) {
                cb(null);
                return;
            }
            cb(null, delta);
        }
    });
    return frameReadable(pipeline(lists, deltas, noop));
}
function noop() { }
