import { isRecord } from '../../guards.js';
const BLOCKED_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);
export const MAX_RESPONSE_CHARS = 8192;
export const TIMEOUT_MS = 10_000;
export function isRedirectStatus(status) {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
export function parseObjectArg(v, name) {
    if (v === null || v === undefined) {
        return { ok: true, value: undefined };
    }
    let value = v;
    if (typeof v === 'string') {
        try {
            value = JSON.parse(v);
        }
        catch {
            return { ok: false, error: `${name} must be an object` };
        }
    }
    if (!isPlainRecord(value)) {
        return { ok: false, error: `${name} must be an object` };
    }
    return { ok: true, value };
}
const BODY_JSON_ERROR = 'body is not valid JSON — resend it as one complete JSON object';
export function parseJsonBody(body, contentType) {
    if (typeof body !== 'string') {
        return { ok: true, value: body };
    }
    if (contentType !== undefined && !/json/i.test(contentType)) {
        return { ok: true, value: body };
    }
    const text = body.trim();
    if (text[0] !== '{' && text[0] !== '[') {
        return { ok: true, value: body };
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return { ok: false, error: BODY_JSON_ERROR };
    }
    return { ok: true, value: isPlainRecord(parsed) ? parsed : body };
}
function isPlainRecord(value) {
    return isRecord(value) && !Array.isArray(value);
}
export function applyQuery(url, query) {
    for (const [key, value] of Object.entries(query)) {
        if (value === null || value === undefined)
            continue;
        if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(key, String(item));
            }
        }
        else {
            url.searchParams.append(key, String(value));
        }
    }
}
export function contentTypeOf(headers) {
    if (typeof headers !== 'object' || headers === null)
        return undefined;
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'content-type') {
            return String(value);
        }
    }
    return undefined;
}
export function buildHeaders(headerArgs) {
    const headers = {};
    for (const [key, value] of Object.entries(headerArgs)) {
        if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
            headers[key] = String(value);
        }
    }
    return headers;
}
export function encodeBody(body, headers) {
    if (body === null || body === undefined)
        return undefined;
    if (typeof body !== 'object') {
        return String(body);
    }
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
    }
    return JSON.stringify(body);
}
