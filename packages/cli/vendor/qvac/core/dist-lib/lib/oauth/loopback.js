import { createServer } from 'http';
import { OAUTH_CALLBACK_PATH, OAUTH_WAIT_FOR_CODE_TIMEOUT_MS, oauthRedirectUri } from './keys.js';
import { CoreError } from '../errors.js';
const DONE_PAGE = '<html><body><p>Authorization complete. Return to QV.AC to finish connecting. You may close this tab.</p>' +
    '<script>window.close();</script></body></html>';
const STALE_PAGE = '<html><body><p>This sign-in link is from an earlier attempt. ' +
    'You can close this tab.</p></body></html>';
const loopbacks = new Set();
export async function abortOAuthLoopback(credentialKey) {
    return abortFor(credentialKey, new CoreError('OAUTH_CANCELLED'));
}
function abortFor(credentialKey, reason) {
    const pending = [...loopbacks]
        .flatMap((loopback) => [...loopback.waiters.values()])
        .filter((waiter) => waiter.credentialKey === credentialKey && waiter.settled === null);
    for (const waiter of pending) {
        settle(waiter, { ok: false, error: reason });
    }
    return pending.length > 0;
}
export function deliverOAuthCallback(address) {
    const params = callbackParams(address);
    const state = params?.get('state');
    const waiter = state ? pendingWaiter(state) : undefined;
    if (!params || !state || !waiter) {
        return false;
    }
    settle(waiter, callbackSettlement(params, state));
    return true;
}
function callbackParams(address) {
    let url;
    try {
        url = new URL(address.trim());
    }
    catch {
        return null;
    }
    const finished = url.searchParams.has('code') || url.searchParams.has('error');
    return url.pathname === OAUTH_CALLBACK_PATH && finished ? url.searchParams : null;
}
function pendingWaiter(state) {
    for (const loopback of loopbacks) {
        const waiter = loopback.waiters.get(state);
        if (waiter && waiter.settled === null) {
            return waiter;
        }
    }
    return undefined;
}
export async function openOAuthLoopback(port, target) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new CoreError('OAUTH_LOOPBACK_PORT_INVALID', [port]);
    }
    abortFor(target.credentialKey, new CoreError('OAUTH_SUPERSEDED'));
    const loopback = acquire(port);
    if (loopback.waiters.has(target.state)) {
        throw new CoreError('OAUTH_LOOPBACK_BUSY', [port, target.state]);
    }
    const waiter = {
        credentialKey: target.credentialKey,
        returnTo: target.returnTo,
        deliver: null,
        settled: null
    };
    loopback.waiters.set(target.state, waiter);
    let bound;
    try {
        bound = await loopback.ready;
    }
    catch (error) {
        release(loopback, target.state);
        throw error;
    }
    let released = false;
    return {
        redirectUri: oauthRedirectUri(bound.port),
        waitForCode(timeoutMs = OAUTH_WAIT_FOR_CODE_TIMEOUT_MS) {
            if (waiter.settled) {
                return promiseFor(waiter.settled);
            }
            if (waiter.deliver) {
                throw new Error('OAuth loopback is already waiting for this code');
            }
            return new Promise((resolve, reject) => {
                const timer = globalThis.setTimeout(() => settle(waiter, { ok: false, error: new CoreError('OAUTH_CALLBACK_TIMEOUT') }), timeoutMs);
                waiter.deliver = (settlement) => {
                    globalThis.clearTimeout(timer);
                    if (settlement.ok) {
                        resolve(settlement.result);
                    }
                    else {
                        reject(settlement.error);
                    }
                };
            });
        },
        close() {
            if (released)
                return;
            released = true;
            settle(waiter, { ok: false, error: new CoreError('OAUTH_LOOPBACK_CLOSED') });
            release(loopback, target.state);
        }
    };
}
function acquire(port) {
    const existing = port === 0 ? undefined : [...loopbacks].find((l) => l.requestedPort === port);
    if (existing && !existing.teardown) {
        return existing;
    }
    const settled = existing?.teardown ?? Promise.resolve();
    if (existing) {
        loopbacks.delete(existing);
    }
    const waiters = new Map();
    const loopback = {
        requestedPort: port,
        waiters,
        ready: settled.then(() => listen(port, waiters)),
        teardown: null
    };
    loopbacks.add(loopback);
    return loopback;
}
function release(loopback, state) {
    loopback.waiters.delete(state);
    if (loopback.waiters.size > 0) {
        return;
    }
    const teardown = loopback.ready.then(closeServer, () => undefined);
    loopback.teardown = teardown;
    teardown.then(() => loopbacks.delete(loopback));
}
function closeServer(bound) {
    return new Promise((resolve) => {
        bound.server.closeAllConnections?.();
        bound.server.close(() => resolve());
    });
}
function listen(port, waiters) {
    return new Promise((resolve, reject) => {
        const server = createServer((request, response) => {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            if (url.pathname !== OAUTH_CALLBACK_PATH) {
                respond(response, 404, { contentType: 'text/plain', body: 'Not found' });
                return;
            }
            const state = url.searchParams.get('state');
            if (state === null) {
                respond(response, 200, { contentType: 'text/html; charset=utf-8', body: STALE_PAGE });
                return;
            }
            const waiter = waiters.get(state);
            if (!waiter || waiter.settled) {
                respond(response, 200, { contentType: 'text/html; charset=utf-8', body: STALE_PAGE });
                return;
            }
            if (waiter.returnTo) {
                redirect(response, waiter.returnTo);
            }
            else {
                respond(response, 200, { contentType: 'text/html; charset=utf-8', body: DONE_PAGE });
            }
            settle(waiter, callbackSettlement(url.searchParams, state));
        });
        let listening = false;
        server.on('error', (error) => {
            if (listening)
                return;
            reject('code' in error && error.code === 'EADDRINUSE'
                ? new CoreError('OAUTH_LOOPBACK_PORT_IN_USE', [port])
                : error);
        });
        server.once('listening', () => {
            listening = true;
            const address = server.address();
            if (typeof address !== 'object' || !address) {
                server.close();
                reject(new Error('OAuth loopback bound to no address'));
                return;
            }
            resolve({ server, port: address.port });
        });
        server.listen(port, '127.0.0.1');
    });
}
function callbackSettlement(params, state) {
    const error = params.get('error');
    if (error) {
        return { ok: false, error: new CoreError('OAUTH_PROVIDER_ERROR', [error]) };
    }
    const code = params.get('code');
    if (!code) {
        return { ok: false, error: new CoreError('OAUTH_CALLBACK_INVALID') };
    }
    return { ok: true, result: { code, state } };
}
function settle(waiter, settlement) {
    if (waiter.settled)
        return;
    waiter.settled = settlement;
    const deliver = waiter.deliver;
    waiter.deliver = null;
    deliver?.(settlement);
}
function promiseFor(settlement) {
    return settlement.ok ? Promise.resolve(settlement.result) : Promise.reject(settlement.error);
}
function respond(response, status, { contentType, body }) {
    response.writeHead(status, { 'Content-Type': contentType, Connection: 'close' });
    response.end(body);
}
function redirect(response, location) {
    response.writeHead(302, { Location: location, Connection: 'close' });
    response.end();
}
