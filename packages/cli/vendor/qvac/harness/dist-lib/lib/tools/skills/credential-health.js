import { HarnessLog } from '../../log.js';
import { scopeKey } from './scope-key.js';
const rejected = new Set();
const lastProbedAt = new Map();
function scopedKey(key, agentId, skill) {
    return scopeKey({ agentId, skill, key });
}
export function markCredentialRejected(key, agentId, skill) {
    rejected.add(scopedKey(key, agentId, skill));
}
export function markCredentialValid(key, agentId, skill) {
    rejected.delete(scopedKey(key, agentId, skill));
    if (skill) {
        rejected.delete(scopedKey(key, agentId));
    }
}
export function recordCredentialHealth(key, status, agentId) {
    if (status === 401 || status === 403) {
        HarnessLog.warn('credential rejected by provider', { key, status });
        markCredentialRejected(key, agentId);
    }
    else if (status < 400) {
        if (isCredentialRejected(key, agentId)) {
            HarnessLog.info('credential recovered', { key });
        }
        markCredentialValid(key, agentId);
    }
}
export function isCredentialRejected(key, agentId, skill) {
    if (rejected.has(scopedKey(key, agentId)))
        return true;
    return skill ? rejected.has(scopedKey(key, agentId, skill)) : false;
}
export function credentialLastProbedAt(key, agentId, skill) {
    return lastProbedAt.get(scopedKey(key, agentId, skill));
}
export function setCredentialLastProbedAt(key, at, { agentId, skill } = {}) {
    lastProbedAt.set(scopedKey(key, agentId, skill), at);
}
export function resetCredentialHealth(key, agentId, skill) {
    const sk = scopedKey(key, agentId, skill);
    rejected.delete(sk);
    lastProbedAt.delete(sk);
    if (skill) {
        const shared = scopedKey(key, agentId);
        rejected.delete(shared);
        lastProbedAt.delete(shared);
    }
}
export function resetAllCredentialHealth() {
    rejected.clear();
    lastProbedAt.clear();
}
