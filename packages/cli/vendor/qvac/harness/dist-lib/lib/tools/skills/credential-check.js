import fetch from '#fetch';
import { Headers } from '#headers';
import { AbortController } from 'bare-abort-controller';
import { DEFAULT_USER_AGENT } from '../../user-agent.js';
import { isRecord } from '../../guards.js';
import { credentialRecord, isCredentialUrlAllowed } from './auth-resolver.js';
import { credentialLastProbedAt, markCredentialRejected, markCredentialValid, setCredentialLastProbedAt } from './credential-health.js';
const TIMEOUT_MS = 5_000;
export const CREDENTIAL_CHECK_TTL_MS = 45_000;
const inflight = new Map();
function scopedKey(key, agentId) {
    return agentId ? `${agentId}\0${key}` : key;
}
export async function validateCredentialChecks(catalog, { credentialStore, agentId, fetchImpl, refresh = false, now = Date.now, ttlMs = CREDENTIAL_CHECK_TTL_MS } = {}) {
    if (!credentialStore)
        return;
    const doFetch = fetchImpl ?? fetch;
    const checks = new Map();
    for (const skill of catalog) {
        for (const [key, check] of Object.entries(skill.requires?.credentialChecks ?? {})) {
            if (!isCredentialUrlAllowed(check.url, skill.allowList))
                continue;
            if (!checks.has(key)) {
                checks.set(key, { check, skill: skill.name });
            }
        }
    }
    const at = now();
    await Promise.all([...checks].map(async ([key, { check, skill }]) => {
        if (!refresh) {
            const last = credentialLastProbedAt(key, agentId);
            if (last !== undefined && at - last < ttlMs) {
                return;
            }
        }
        const sk = scopedKey(key, agentId);
        const pending = inflight.get(sk);
        if (pending) {
            await pending;
            return;
        }
        const probe = runCheck(key, check, {
            skill,
            credentialStore,
            agentId,
            fetchImpl: doFetch
        }).finally(() => {
            inflight.delete(sk);
        });
        inflight.set(sk, probe);
        await probe;
        setCredentialLastProbedAt(key, now(), { agentId });
    }));
}
async function runCheck(key, check, { skill, credentialStore, agentId, fetchImpl }) {
    const record = credentialRecord(await credentialStore(key, { agentId, skills: [skill] }));
    if (!record) {
        return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('credential check timed out'), TIMEOUT_MS);
    try {
        const headers = new Headers(check.headers);
        if (!headers.has('user-agent')) {
            headers.set('user-agent', DEFAULT_USER_AGENT);
        }
        headers.set('Authorization', `Bearer ${record.token}`);
        const response = await fetchImpl(check.url, {
            method: check.method ?? 'GET',
            headers: headers,
            signal: controller.signal
        });
        const rejected = response.status === 401 || response.status === 403 || (await hasMcpAuthError(response));
        if (rejected) {
            markCredentialRejected(key, agentId);
        }
        else if (response.status >= 200 && response.status < 300) {
            markCredentialValid(key, agentId);
        }
    }
    catch {
    }
    finally {
        clearTimeout(timer);
    }
}
async function hasMcpAuthError(response) {
    if (response.status < 200 || response.status >= 300 || !response.text) {
        return false;
    }
    try {
        const body = JSON.parse(await response.text());
        const error = isRecord(body) ? body.error : undefined;
        if (!isRecord(error)) {
            return false;
        }
        if (error.code === 401 || error.code === 403) {
            return true;
        }
        return (typeof error.message === 'string' &&
            /unauthori[sz]ed|forbidden|token.*expired/i.test(error.message));
    }
    catch {
        return false;
    }
}
