import { AbortedError } from '@qvac/harness/race-abort';
import { CoreError } from '../errors.js';
import { unref } from '../unref.js';
export const UPLOAD_INACTIVITY_MS = 30_000;
export function nextFrame(iterator, { signal, inactivityMs = UPLOAD_INACTIVITY_MS } = {}) {
    if (signal?.aborted) {
        return Promise.reject(new AbortedError());
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new CoreError('UPLOAD_TIMEOUT')), inactivityMs);
        unref(timer);
        const abort = () => finish(new AbortedError());
        const finish = (error, result) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            if (error) {
                reject(error);
            }
            else if (result) {
                resolve(result);
            }
        };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            iterator.next().then((result) => finish(undefined, result), finish);
        }
        catch (error) {
            finish(error);
        }
    });
}
