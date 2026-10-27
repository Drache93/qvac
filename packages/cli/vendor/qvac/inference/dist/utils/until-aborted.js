const ABORTED = Symbol('aborted');
/**
 * Iterates `source` until `signal` aborts, then ends without an error. Races
 * each `next()` against the signal, since `return()` waits behind a pending
 * `next()`. A rejection after the abort is dropped.
 */
export async function* untilAborted(source, signal) {
    if (!signal) {
        yield* source;
        return;
    }
    try {
        while (!signal.aborted) {
            const next = source.next();
            const result = await new Promise((resolve, reject) => {
                const onAbort = () => resolve(ABORTED);
                signal.addEventListener('abort', onAbort, { once: true });
                next.then((value) => {
                    signal.removeEventListener('abort', onAbort);
                    resolve(value);
                }, (error) => {
                    signal.removeEventListener('abort', onAbort);
                    reject(error);
                });
            });
            if (result === ABORTED || result.done)
                return;
            yield result.value;
        }
    }
    finally {
        void source.return(undefined).catch(() => { });
    }
}
