import { isRecord } from '../../lib/guards.js';
import { METADATA_METHODS } from '../../lib/helpers/mcp-methods.js';
import { MAX_RESPONSE_CHARS } from '../../lib/tools/http-request/request.js';
export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const TIMEOUT_MS = 30_000;
const PROTOCOL_METHODS = new Set([...METADATA_METHODS, 'tools/call']);
export function isNotification(method) {
    return method.startsWith('notifications/');
}
export function normalizeMethod(method, params) {
    if (method === 'tools/call') {
        const p = params ?? {};
        return { method, params: p.arguments === undefined ? { ...p, arguments: {} } : p };
    }
    if (PROTOCOL_METHODS.has(method) || isNotification(method)) {
        return { method, params };
    }
    return { method: 'tools/call', params: { name: method, arguments: params ?? {} } };
}
let nextId = 1;
function buildEnvelope(method, params) {
    const envelope = { jsonrpc: '2.0', method };
    if (params !== undefined) {
        envelope.params = params;
    }
    if (!isNotification(method)) {
        envelope.id = String(nextId++);
    }
    return JSON.stringify(envelope);
}
function headers(authHeader, sessionId) {
    const h = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
    };
    if (authHeader) {
        h.authorization = authHeader;
    }
    if (sessionId) {
        h['mcp-session-id'] = sessionId;
    }
    return h;
}
function eventData(event) {
    return event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
}
function decodePayload(body, contentType) {
    let payload = body;
    if (contentType.includes('text/event-stream')) {
        const events = body.split(/\r?\n\r?\n/);
        for (let i = events.length - 1; i >= 0; i--) {
            const data = eventData(events[i] ?? '');
            if (data) {
                payload = data;
                break;
            }
        }
    }
    try {
        return JSON.stringify(JSON.parse(payload), null, 2);
    }
    catch {
        return payload;
    }
}
function asRecord(value) {
    return isRecord(value) && !Array.isArray(value) ? value : null;
}
function contentText(result) {
    const content = result?.content;
    if (!Array.isArray(content)) {
        return null;
    }
    const texts = content.flatMap((entry) => {
        const item = asRecord(entry);
        return item?.type === 'text' && typeof item.text === 'string' ? [item.text] : [];
    });
    return texts.length > 0 ? texts.join('\n\n') : null;
}
function rpcErrorText(error) {
    const message = typeof error.message === 'string' ? error.message.trim() : '';
    if (error.data === undefined) {
        return message;
    }
    return `${message} ${JSON.stringify(error.data)}`.trim();
}
export function flattenMcpResponse(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return { body: truncate(body) };
    }
    const record = asRecord(parsed);
    if (!record) {
        return { body: truncate(body) };
    }
    const rpcError = asRecord(record.error);
    if (rpcError) {
        return { error: truncate(rpcErrorText(rpcError) || body.trim()) };
    }
    const result = asRecord(record.result);
    const text = contentText(result)?.trim();
    if (result?.isError === true) {
        return { error: truncate(text || body.trim()) };
    }
    return { body: truncate(text || body) };
}
function truncate(text) {
    return text.length > MAX_RESPONSE_CHARS
        ? `${text.slice(0, MAX_RESPONSE_CHARS)}… [truncated]`
        : text;
}
const SESSION_CACHE = new Map();
const SESSION_CACHE_MAX = 256;
export function sessionKey(url, ctx, credentialKey) {
    return `${url}|${ctx?.agentId ?? ''}|${credentialKey ?? ''}`;
}
export function getSession(key) {
    return SESSION_CACHE.get(key) ?? '';
}
export function deleteSession(key) {
    SESSION_CACHE.delete(key);
}
export function cacheSession(key, sessionId) {
    SESSION_CACHE.set(key, sessionId);
    if (SESSION_CACHE.size > SESSION_CACHE_MAX) {
        const oldest = SESSION_CACHE.keys().next().value;
        if (oldest !== undefined) {
            SESSION_CACHE.delete(oldest);
        }
    }
}
export function post(fetch, url, { method, params, authHeader, sessionId, signal }) {
    return fetch(url, {
        method: 'POST',
        headers: headers(authHeader, sessionId),
        body: buildEnvelope(method, params),
        signal,
        redirect: 'manual'
    });
}
export async function readBody(response) {
    return decodePayload(await response.text(), response.headers.get('content-type') ?? '');
}
export function needsSession(status, cached) {
    return status === 400 || (status === 404 && cached !== '');
}
export async function establishSession(fetch, url, { authHeader, signal }) {
    const init = await post(fetch, url, {
        method: 'initialize',
        params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'QV.AC', version: '0.8.x' }
        },
        authHeader,
        sessionId: undefined,
        signal
    });
    const sessionId = init.headers.get('mcp-session-id');
    if (init.status < 200 || init.status >= 300) {
        return { error: `initialize failed: ${init.status}\n${await readBody(init)}` };
    }
    if (!sessionId) {
        return { error: 'initialize returned no Mcp-Session-Id header', stateless: true };
    }
    await post(fetch, url, {
        method: 'notifications/initialized',
        params: undefined,
        authHeader,
        sessionId,
        signal
    });
    return sessionId;
}
