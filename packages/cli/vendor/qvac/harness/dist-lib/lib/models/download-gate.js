import { AbortedError, raceAbort } from '../helpers/race-abort.js';
function deferred() {
    const next = Promise.withResolvers();
    next.promise.catch(noop);
    return next;
}
export function createDownloadGate({ isCached, onHeld, onDropped }) {
    let allowed = true;
    let woke = deferred();
    let dropped = deferred();
    const wake = () => {
        const woken = woke;
        woke = deferred();
        woken.resolve();
    };
    const wait = async (held, signal, onWait) => {
        const drop = dropped;
        const cancelled = () => signal?.aborted === true || drop !== dropped;
        for (;;) {
            const change = Promise.race([raceAbort(woke.promise, signal), drop.promise]);
            change.catch(noop);
            const ready = allowed || (await isCached(held.model, held.addon).catch(() => false));
            if (cancelled()) {
                throw new AbortedError();
            }
            if (ready) {
                return;
            }
            onWait();
            await change;
        }
    };
    return {
        get allowed() {
            return allowed;
        },
        setAllowed(next) {
            allowed = next;
            if (allowed) {
                wake();
            }
        },
        downloaded: wake,
        async hold(model, addon, signal) {
            if (allowed)
                return;
            if (signal?.aborted)
                throw new AbortedError();
            const held = { model, addon };
            let shown = false;
            try {
                await wait(held, signal, () => {
                    if (!shown) {
                        shown = true;
                        onHeld(held);
                    }
                });
            }
            catch (err) {
                if (shown) {
                    onDropped(held);
                }
                throw err;
            }
        },
        abandon() {
            const abandoned = dropped;
            dropped = deferred();
            abandoned.reject(new AbortedError());
        }
    };
}
function noop() { }
