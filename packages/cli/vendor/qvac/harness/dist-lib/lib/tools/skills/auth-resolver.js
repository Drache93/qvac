import { raceAbort } from '../../helpers/race-abort.js';
import { parseObjectArg } from '../http-request/request.js';
export function credentialRecord(value) {
    if (typeof value === 'string') {
        return value ? { token: value } : null;
    }
    return value?.token ? value : null;
}
export function isCredentialExpired(record, now = Date.now()) {
    return typeof record.expiresAt === 'number' && now + 60_000 >= record.expiresAt;
}
function pathAllowed(target, prefix) {
    if (target === prefix)
        return true;
    return target.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}
function matchesPattern(url, pattern) {
    const glob = pattern.endsWith('*');
    const raw = glob ? pattern.slice(0, -1) : pattern;
    let base;
    try {
        base = new URL(raw);
    }
    catch {
        return url.href.startsWith(raw);
    }
    if (url.protocol !== base.protocol || url.host !== base.host) {
        return false;
    }
    return glob ? url.pathname.startsWith(base.pathname) : pathAllowed(url.pathname, base.pathname);
}
export function urlAllowed(url, patterns) {
    return patterns.some((p) => matchesPattern(url, p));
}
export function isCredentialUrlAllowed(target, patterns) {
    try {
        return urlAllowed(new URL(target), patterns);
    }
    catch {
        return false;
    }
}
export function parseAuth(v) {
    const parsed = parseObjectArg(v, 'auth');
    if (!parsed.ok) {
        return parsed;
    }
    if (!parsed.value) {
        return { ok: true, value: undefined };
    }
    const { type, tokenCredentialKey } = parsed.value;
    if (type !== undefined && type !== 'bearer') {
        return { ok: false, error: `unsupported auth type: ${String(type)}` };
    }
    const key = typeof tokenCredentialKey === 'string' && tokenCredentialKey.length > 0
        ? tokenCredentialKey
        : null;
    if (key === null) {
        const blank = tokenCredentialKey === undefined || tokenCredentialKey === null || tokenCredentialKey === '';
        if (!blank) {
            return { ok: false, error: 'auth.tokenCredentialKey must be a non-empty string' };
        }
        return { ok: true, value: undefined };
    }
    return { ok: true, value: { type: 'bearer', tokenCredentialKey: key } };
}
function grantedKeys(url, credentialAllowList) {
    return Object.entries(credentialAllowList)
        .filter(([, entry]) => urlAllowed(url, Array.isArray(entry) ? entry : [entry]))
        .map(([key]) => key);
}
async function connectedCredentials(keys, credentialStore, ctx) {
    const connected = [];
    for (const key of keys) {
        const record = credentialRecord(await credentialStore(key, ctx));
        if (record) {
            connected.push({ token: record.token, key });
        }
    }
    return connected;
}
function ambiguous(keys) {
    return {
        error: `multiple credentials match this URL; set auth.tokenCredentialKey to one of ${keys.join(', ')}`
    };
}
async function resolveGuessedKey(key, url, { credentialStore, credentialAllowList = {}, ctx }) {
    const granted = grantedKeys(url, credentialAllowList);
    if (granted.length === 0) {
        return {
            error: `unknown credential key ${key}; no loaded skill grants a credential for ${url.host} — omit auth, or load the skill that declares it`
        };
    }
    const [first, ...rest] = await connectedCredentials(granted, credentialStore, ctx);
    if (!first) {
        return {
            error: `unknown credential key ${key}; no connected credential for ${url.host} (${granted.join(', ')}). Tell the user to connect it in Skills; do not retry`
        };
    }
    if (rest.length > 0) {
        return ambiguous([first, ...rest].map((c) => c.key));
    }
    return first;
}
async function resolveDeclaredKey(key, url, { credentialStore, credentialAllowList, ctx }) {
    const entry = credentialAllowList?.[key];
    if (!entry) {
        return null;
    }
    const patterns = Array.isArray(entry) ? entry : [entry];
    if (!urlAllowed(url, patterns)) {
        return { error: `credential ${key} is not allowed for URL ${url.href}` };
    }
    const record = credentialRecord(await credentialStore(key, ctx));
    if (!record) {
        return {
            error: `credential ${key} is not connected for ${url.host}. Tell the user to connect it in Skills; do not retry`
        };
    }
    return { token: record.token, key };
}
export async function resolveAuth(auth, url, credentialStore, credentialAllowList, ctx) {
    const key = auth.tokenCredentialKey;
    if (!credentialStore) {
        return { error: 'credentials not configured' };
    }
    const access = { credentialStore, credentialAllowList, ctx };
    return (await resolveDeclaredKey(key, url, access)) ?? resolveGuessedKey(key, url, access);
}
export async function resolveAutoAuth(url, credentialStore, credentialAllowList, ctx) {
    if (!credentialStore || !credentialAllowList)
        return null;
    const connected = await connectedCredentials(grantedKeys(url, credentialAllowList), credentialStore, ctx);
    if (connected.length > 1) {
        return ambiguous(connected.map((c) => c.key));
    }
    return connected[0] ?? null;
}
export async function resolveBearerHeader(auth, url, credentialStore, credentialAllowList, ctx, signal) {
    if (auth) {
        const resolved = await raceAbort(resolveAuth(auth, url, credentialStore, credentialAllowList, ctx), signal);
        if ('error' in resolved) {
            return { error: resolved.error };
        }
        return { header: `Bearer ${resolved.token}`, credentialKey: resolved.key };
    }
    const resolved = await raceAbort(resolveAutoAuth(url, credentialStore, credentialAllowList, ctx), signal);
    if (resolved && 'error' in resolved) {
        return resolved;
    }
    return resolved
        ? { header: `Bearer ${resolved.token}`, credentialKey: resolved.key }
        : { header: null };
}
export async function resolveRedirectBearerHeader(auth, url, credentialStore, credentialAllowList, ctx, signal) {
    if (!auth || !credentialStore) {
        return { header: null };
    }
    const resolved = await raceAbort(resolveDeclaredKey(auth.tokenCredentialKey, url, { credentialStore, credentialAllowList, ctx }), signal);
    return !resolved || 'error' in resolved
        ? { header: null }
        : { header: `Bearer ${resolved.token}`, credentialKey: resolved.key };
}
