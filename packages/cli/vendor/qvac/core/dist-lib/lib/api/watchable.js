import b4a from 'b4a';
import { Readable } from 'streamx';
import { frameReadable } from '../frame-readable.js';
import { asError, isRecord } from '../guards.js';
const SCOPE = ['api', 'watch'];
const CHURN_WINDOW_MS = 30_000;
export function snapshotEquals(a, b) {
    if (a === b)
        return true;
    if (b4a.isBuffer(a) || b4a.isBuffer(b)) {
        return b4a.isBuffer(a) && b4a.isBuffer(b) && b4a.equals(a, b);
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }
        return a.every((item, i) => snapshotEquals(item, b[i]));
    }
    if (!isRecord(a) || !isRecord(b)) {
        return false;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
        return false;
    }
    return keys.every((key) => snapshotEquals(a[key], b[key]));
}
export function watchable(storeOf, query, { name, log, changes }) {
    return (request) => {
        const resolved = storeOf(request);
        const pending = resolved instanceof Promise ? resolved.catch(noop) : null;
        let store = resolved instanceof Promise ? null : resolved;
        let dirty = true;
        let ended = false;
        let last = null;
        let wake = null;
        let churn = 0;
        let reportedAt = Date.now();
        const reportChurn = (force) => {
            if (churn === 0)
                return;
            const now = Date.now();
            const elapsed = now - reportedAt;
            if (!force && elapsed < CHURN_WINDOW_MS) {
                return;
            }
            log?.debug(SCOPE, `${name} woke with no change`, { woke: churn, ms: elapsed });
            churn = 0;
            reportedAt = now;
        };
        const countUnchanged = () => {
            if (store?.sampled)
                return;
            churn++;
            reportChurn(false);
        };
        const onChange = () => {
            dirty = true;
            wake?.resolve();
            wake = null;
        };
        const onStoreClose = () => {
            ended = true;
            wake?.resolve();
            wake = null;
        };
        const storeGone = () => store === null || ended || Boolean(store.closed) || Boolean(store.closing);
        const stream = new Readable({
            async open(cb) {
                if (pending) {
                    store = (await pending) ?? null;
                }
                store?.watch(onChange);
                changes?.watch(onChange);
                store?.once?.('close', onStoreClose);
                cb(null);
            },
            async read(cb) {
                try {
                    while (!stream.destroying) {
                        if (store === null || storeGone()) {
                            stream.push(null);
                            break;
                        }
                        if (!dirty) {
                            wake = Promise.withResolvers();
                            await wake.promise;
                            continue;
                        }
                        dirty = false;
                        const next = await query(request, store);
                        if (storeGone()) {
                            stream.push(null);
                            break;
                        }
                        if (snapshotEquals(next, last)) {
                            countUnchanged();
                            continue;
                        }
                        reportChurn(true);
                        last = next;
                        stream.push(next);
                        break;
                    }
                    cb(null);
                }
                catch (err) {
                    if (storeGone()) {
                        stream.push(null);
                        cb(null);
                    }
                    else {
                        cb(asError(err));
                    }
                }
            },
            predestroy() {
                onChange();
            },
            destroy(cb) {
                reportChurn(true);
                store?.unwatch(onChange);
                changes?.unwatch(onChange);
                store?.off?.('close', onStoreClose);
                cb(null);
            }
        });
        return frameReadable(stream);
    };
}
function noop() { }
