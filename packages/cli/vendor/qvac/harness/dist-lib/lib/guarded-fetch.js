import { AbortController } from 'bare-abort-controller';
import b4a from 'b4a';
import { noRedirectFetch } from '#no-redirect-fetch';
import { HarnessError } from './errors.js';
import { lookupHost } from './dns-lookup.js';
import { checkOutboundHost, resolveOutboundUrl } from './tools/url-guard.js';
export const MAX_RESPONSE_BYTES = 100 * 1024 * 1024;
const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 120_000;
const CHUNK_BYTES = 1024 * 1024;
function isRedirect(status) {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
function headerPairs(headers) {
    if (Array.isArray(headers))
        return headers;
    if ('entries' in headers && typeof headers.entries === 'function') {
        return headers.entries();
    }
    return Object.entries(headers);
}
function headerRecord(headers) {
    const out = {};
    if (!headers || typeof headers !== 'object') {
        return out;
    }
    const pairs = headerPairs(headers);
    for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length < 2)
            continue;
        out[String(pair[0])] = String(pair[1]);
    }
    return out;
}
function bodyBytes(body) {
    if (body === undefined || body === null)
        return undefined;
    if (typeof body === 'string')
        return body;
    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }
    if (ArrayBuffer.isView(body)) {
        return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }
    return String(body);
}
function plain(bytes) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
class GuardedHeaders {
    #map;
    constructor(entries) {
        this.#map = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));
    }
    get(name) {
        return this.#map.get(name.toLowerCase()) ?? null;
    }
    has(name) {
        return this.#map.has(name.toLowerCase());
    }
    entries() {
        return this.#map.entries();
    }
    keys() {
        return this.#map.keys();
    }
    values() {
        return this.#map.values();
    }
    forEach(fn) {
        this.#map.forEach((value, key) => fn(value, key));
    }
    [Symbol.iterator]() {
        return this.#map.entries();
    }
}
export class GuardedResponse {
    type = 'basic';
    statusText = '';
    status;
    headers;
    url;
    redirected;
    #bytes;
    #used = false;
    constructor(bytes, { status, headers, url, redirected }) {
        this.status = status;
        this.headers = new GuardedHeaders(headers);
        this.#bytes = bytes;
        this.url = url;
        this.redirected = redirected;
    }
    get ok() {
        return this.status >= 200 && this.status < 300;
    }
    get bodyUsed() {
        return this.#used;
    }
    get body() {
        let offset = 0;
        const bytes = this.#bytes;
        return {
            getReader: () => {
                this.#used = true;
                return {
                    read: async () => {
                        if (offset >= bytes.byteLength) {
                            return { done: true };
                        }
                        const value = plain(bytes.subarray(offset, offset + CHUNK_BYTES));
                        offset += value.byteLength;
                        return { done: false, value };
                    },
                    cancel: async () => {
                        offset = bytes.byteLength;
                    },
                    releaseLock: () => { }
                };
            }
        };
    }
    async arrayBuffer() {
        this.#used = true;
        return new Uint8Array(this.#bytes).buffer;
    }
    async bytes() {
        return new Uint8Array(await this.arrayBuffer());
    }
    async text() {
        this.#used = true;
        return b4a.toString(this.#bytes, 'utf8');
    }
    async json() {
        return JSON.parse(await this.text());
    }
    clone() {
        return new GuardedResponse(this.#bytes, {
            status: this.status,
            headers: [...this.headers.entries()],
            url: this.url,
            redirected: this.redirected
        });
    }
}
export function createGuardedFetch(options = {}) {
    const send = options.fetch ?? noRedirectFetch;
    const mayConnect = options.mayConnect ?? allowAll;
    const resolveHost = options.resolveHost ?? lookupHost;
    const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
    const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    return async (input, init = {}) => {
        let url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        let method = (init.method ?? 'GET').toUpperCase();
        let body = bodyBytes(init.body);
        const headers = headerRecord(init.headers);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(undefined), timeoutMs);
        for (const signal of [options.signal, init.signal]) {
            if (signal?.aborted) {
                controller.abort(undefined);
            }
            signal?.addEventListener('abort', () => controller.abort(undefined));
        }
        try {
            for (let hops = 0;; hops++) {
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    throw new HarnessError('FETCH_REFUSED', [`unsupported protocol ${url.protocol}`]);
                }
                const literal = checkOutboundHost(url);
                if (literal) {
                    throw new HarnessError('FETCH_REFUSED', [`${literal}`]);
                }
                if (!(await mayConnect(url.hostname))) {
                    throw new HarnessError('FETCH_REFUSED', [`${url.hostname} was not approved for this run`]);
                }
                const check = await resolveOutboundUrl(url, {
                    resolveHost,
                    signal: controller.signal
                });
                if (check.blocked) {
                    throw new HarnessError('FETCH_REFUSED', [`${check.blocked}`]);
                }
                const response = await send(url, {
                    method,
                    headers,
                    body,
                    signal: controller.signal,
                    validatedAddresses: check.addresses,
                    maxBytes
                });
                const location = response.headers.get('location');
                if (!isRedirect(response.status) || !location || init.redirect === 'manual') {
                    return new GuardedResponse(plain(response.bytes()), {
                        status: response.status,
                        headers: response.headers.entries(),
                        url: url.href,
                        redirected: hops > 0
                    });
                }
                if (init.redirect === 'error') {
                    throw new HarnessError('FETCH_REFUSED', ['redirect not allowed']);
                }
                if (hops >= MAX_REDIRECTS) {
                    throw new HarnessError('FETCH_REFUSED', ['too many redirects']);
                }
                const next = new URL(location, url);
                if (next.protocol !== url.protocol || next.host !== url.host) {
                    stripCredentials(headers);
                }
                if (response.status === 303 ||
                    ((response.status === 301 || response.status === 302) && method === 'POST')) {
                    method = 'GET';
                    body = undefined;
                }
                url = next;
            }
        }
        finally {
            clearTimeout(timer);
        }
    };
}
function stripCredentials(headers) {
    for (const name of Object.keys(headers)) {
        if (/^(authorization|cookie)$/i.test(name)) {
            delete headers[name];
        }
    }
}
async function allowAll() {
    return true;
}
