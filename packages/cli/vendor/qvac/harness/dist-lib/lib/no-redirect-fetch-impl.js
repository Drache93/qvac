import b4a from 'b4a';
import { HarnessError } from './errors.js';
import { DEFAULT_USER_AGENT } from './user-agent.js';
const UA_SNIFFING_HOSTS = new Set(['wttr.in']);
export function runNoRedirectFetch(request, url, init = {}) {
    return new Promise((resolve, reject) => {
        const headers = { ...init.headers };
        if (init.body !== undefined &&
            !Object.keys(headers).some((h) => h.toLowerCase() === 'content-length')) {
            headers['content-length'] = String(b4a.byteLength(init.body));
        }
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'user-agent')) {
            headers['user-agent'] = UA_SNIFFING_HOSTS.has(url.hostname.toLowerCase())
                ? ''
                : DEFAULT_USER_AGENT;
        }
        const method = init.method ?? 'GET';
        const req = request(url, { method, headers, validatedAddresses: init.validatedAddresses }, (res) => {
            const chunks = [];
            let received = 0;
            let settled = false;
            const respond = () => {
                if (settled)
                    return;
                settled = true;
                const body = b4a.concat(chunks);
                const responseHeaders = {};
                for (const [name, value] of Object.entries(res.headers)) {
                    responseHeaders[name.toLowerCase()] = String(value);
                }
                resolve({
                    status: res.statusCode,
                    headers: {
                        get: (name) => responseHeaders[name.toLowerCase()] ?? null,
                        entries: () => Object.entries(responseHeaders)
                    },
                    text: () => b4a.toString(body, 'utf8'),
                    bytes: () => body
                });
            };
            const fail = (err) => {
                if (settled)
                    return;
                settled = true;
                reject(err);
            };
            res.on('data', (chunk) => {
                received += chunk.byteLength;
                if (init.maxBytes !== undefined && received > init.maxBytes) {
                    if (init.truncate) {
                        const allowed = chunk.byteLength - (received - init.maxBytes);
                        if (allowed > 0) {
                            chunks.push(chunk.subarray(0, allowed));
                        }
                        respond();
                        req.destroy();
                        return;
                    }
                    const err = new HarnessError('RESPONSE_TOO_LARGE', [init.maxBytes]);
                    req.destroy(err);
                    fail(err);
                    return;
                }
                chunks.push(chunk);
            });
            res.on('error', fail);
            res.on('end', respond);
        });
        req.on('error', reject);
        if (init.signal) {
            const abort = () => {
                const err = new Error('This operation was aborted');
                err.name = 'AbortError';
                req.destroy(err);
                reject(err);
            };
            if (init.signal.aborted) {
                return abort();
            }
            init.signal.addEventListener('abort', abort);
        }
        if (init.body !== undefined) {
            req.write(init.body);
        }
        req.end();
    });
}
