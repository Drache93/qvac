import { Readable } from 'streamx';
import { frameReadable } from '../frame-readable.js';
import { LEVEL_PRIORITIES } from '@qvac/logging/constants';
import { asError } from '../guards.js';
const MAX_LIVE_QUEUE = 1000;
export function createLogsApi(source) {
    return {
        logsWatch: (request) => logStream(source, request),
        writeLog: (request) => {
            source.write({
                level: request.level,
                scope: request.scope ?? [],
                message: request.message,
                at: request.at
            });
            return { ok: true };
        }
    };
}
function logStream(source, request) {
    const matches = makeFilter(request);
    const queue = [];
    let dropped = 0;
    let droppedSeq = 0;
    let backfill = null;
    let wake = null;
    const onRecord = (record) => {
        if (!matches(record))
            return;
        if (queue.length >= MAX_LIVE_QUEUE) {
            droppedSeq = queue[0].seq;
            queue.shift();
            dropped++;
        }
        queue.push(toLine(record));
        wake?.resolve();
        wake = null;
    };
    const stream = new Readable({
        open(cb) {
            source.subscribe(onRecord);
            const history = source.backfill().filter(matches);
            backfill = request.backfill ? history.slice(-request.backfill).map(toLine) : [];
            cb(null);
        },
        async read(cb) {
            try {
                if (backfill) {
                    const initial = backfill;
                    backfill = null;
                    if (initial.length) {
                        stream.push({ lines: initial });
                        return cb(null);
                    }
                }
                while (!stream.destroying) {
                    if (queue.length === 0) {
                        wake = Promise.withResolvers();
                        await wake.promise;
                        continue;
                    }
                    const lines = queue.splice(0);
                    if (dropped > 0) {
                        lines.unshift(droppedMarker(dropped, droppedSeq));
                        dropped = 0;
                    }
                    stream.push({ lines });
                    break;
                }
                cb(null);
            }
            catch (err) {
                cb(asError(err));
            }
        },
        predestroy() {
            wake?.resolve();
            wake = null;
        },
        destroy(cb) {
            source.unsubscribe(onRecord);
            cb(null);
        }
    });
    return frameReadable(stream);
}
function makeFilter(request) {
    const threshold = LEVEL_PRIORITIES[request.level ?? 'debug'];
    const scope = request.scope ?? [];
    const origin = request.origin ?? null;
    return (record) => {
        if (LEVEL_PRIORITIES[record.level] > threshold)
            return false;
        if (origin && record.origin !== origin)
            return false;
        return scope.every((s) => record.scope.includes(s));
    };
}
function toLine(record) {
    return {
        seq: record.seq,
        at: record.at,
        level: record.level,
        scope: [...record.scope],
        message: record.message,
        origin: record.origin,
        originDeviceId: record.originDeviceId
    };
}
function droppedMarker(count, seq) {
    return {
        seq,
        at: Date.now(),
        level: 'warn',
        scope: ['logs'],
        message: `dropped ${count} log lines (slow reader)`,
        origin: 'core'
    };
}
