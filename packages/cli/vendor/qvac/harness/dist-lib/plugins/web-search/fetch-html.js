import { AbortController } from 'bare-abort-controller';
import { errorMessage } from '../../lib/guards.js';
import { HarnessError } from '../../lib/errors.js';
import { BROWSER_UA } from '../../lib/helpers/user-agents.js';
export const ENGINE_TIMEOUT_MS = 8000;
export const MAX_HTML_CHARS = 2_000_000;
export class TimeoutError extends HarnessError {
    constructor(ms) {
        super('FETCH_TIMED_OUT', [ms]);
    }
}
export class AbortError extends HarnessError {
    constructor() {
        super('FETCH_CANCELLED');
    }
}
function buildInit(options, signal) {
    const headers = {
        'User-Agent': BROWSER_UA,
        Accept: options?.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options?.headers
    };
    if (options?.cookies && Object.keys(options.cookies).length > 0) {
        headers['Cookie'] = Object.entries(options.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }
    const init = {
        method: options?.method ?? 'GET',
        headers,
        redirect: 'follow',
        signal
    };
    if (options?.body) {
        return { ...init, body: options.body };
    }
    return init;
}
async function fetchWithTimeout(fetcher, url, options) {
    const callerSignal = options?.signal;
    if (callerSignal?.aborted) {
        throw new AbortError();
    }
    let timedOut = false;
    const ac = new AbortController();
    const timeoutMs = options?.timeoutMs ?? ENGINE_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        ac.abort(undefined);
    }, timeoutMs);
    const onCallerAbort = () => ac.abort(undefined);
    callerSignal?.addEventListener('abort', onCallerAbort);
    try {
        const resp = await fetcher(url, buildInit(options, ac.signal));
        const raw = await resp.text();
        const text = raw.length > MAX_HTML_CHARS ? raw.slice(0, MAX_HTML_CHARS) : raw;
        return { ok: resp.ok, status: resp.status, text };
    }
    catch (err) {
        if (timedOut) {
            throw new TimeoutError(timeoutMs);
        }
        if (callerSignal?.aborted) {
            throw new AbortError();
        }
        throw err;
    }
    finally {
        clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', onCallerAbort);
    }
}
export async function fetchHtml(fetcher, url, options) {
    const { ok, status, text } = await fetchWithTimeout(fetcher, url, options);
    if (!ok) {
        throw new HarnessError('HTTP_STATUS', [status]);
    }
    return text;
}
export class JsonParseError extends HarnessError {
    constructor(chars, cause) {
        super('RESPONSE_NOT_JSON', [chars, errorMessage(cause)], { cause });
    }
}
export async function fetchJson(fetcher, url, options) {
    const { ok, status, text } = await fetchWithTimeout(fetcher, url, {
        ...options,
        accept: options?.accept ?? 'application/json'
    });
    if (!ok) {
        throw new HarnessError('HTTP_STATUS', [status]);
    }
    try {
        return JSON.parse(text);
    }
    catch (err) {
        throw new JsonParseError(text.length, err);
    }
}
