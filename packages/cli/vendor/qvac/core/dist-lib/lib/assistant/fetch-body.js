import defaultFetch from '#fetch';
import b4a from 'b4a';
import {} from 'bare-abort-controller';
import { raceAbort } from '@qvac/harness/race-abort';
export async function raceInactivity(promise, signal, timeoutMs) {
    let timer = null;
    const expired = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('blob read timed out')), timeoutMs);
    });
    try {
        return await raceAbort(Promise.race([promise, expired]), signal);
    }
    finally {
        if (timer !== null) {
            clearTimeout(timer);
        }
    }
}
export async function drainBody(body, signal, timeoutMs) {
    if (!body)
        return null;
    const reader = body.getReader();
    const parts = [];
    try {
        for (;;) {
            const read = await raceInactivity(reader.read(), signal, timeoutMs);
            if (read.done) {
                break;
            }
            parts.push(b4a.from(read.value));
        }
    }
    catch {
        await reader.cancel();
        return null;
    }
    return b4a.concat(parts);
}
