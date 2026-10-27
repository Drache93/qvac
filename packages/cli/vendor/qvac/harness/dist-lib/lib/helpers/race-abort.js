import { AbortedError } from './engine-error.js';
export { AbortedError };
export function raceAbort(promise, signal) {
    if (!signal)
        return promise;
    if (signal.aborted) {
        return Promise.reject(new AbortedError());
    }
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(new AbortedError());
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
}
