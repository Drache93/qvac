import b4a from 'b4a';
import { TERMINAL_STATES } from './assistant/history.js';
export function chatKvCacheKey(chatId) {
    return `chat-${chatId}`;
}
export function chatRepairKvCacheKey(chatId, acceptedRepairs) {
    const base = chatKvCacheKey(chatId);
    return acceptedRepairs > 0 ? `${base}/r${acceptedRepairs}` : base;
}
export function agentSwitched(chunks, request, deviceId) {
    const agentOf = new Map();
    let lastHere = null;
    let switched = false;
    for (const chunk of chunks) {
        if (chunk.type === 'agent-switch') {
            switched = lastHere !== null;
            continue;
        }
        if (!chunk.runId || chunk.runId === request.runId) {
            continue;
        }
        if (chunk.type === 'run-request' && !chunk.capability) {
            agentOf.set(chunk.runId, chunk.runRequest?.agentId);
        }
        else if (agentOf.has(chunk.runId) && executedHere(chunk, deviceId)) {
            lastHere = chunk.runId;
            switched = false;
        }
    }
    return lastHere !== null && (switched || agentOf.get(lastHere) !== request.runRequest?.agentId);
}
function executedHere(chunk, deviceId) {
    return (chunk.type === 'run-status' &&
        !TERMINAL_STATES.has(chunk.runStatus?.state ?? '') &&
        !!chunk.originDeviceId &&
        b4a.equals(chunk.originDeviceId, deviceId));
}
export function disappearedChatIds(known, current) {
    const live = new Set(current);
    const gone = [];
    for (const id of known) {
        if (!live.has(id)) {
            gone.push(id);
        }
    }
    return gone;
}
export function agentRekeyFingerprint(agent) {
    return JSON.stringify([
        agent.bio,
        agent.modelName,
        agent.ctxSize ?? 0,
        agent.kvCacheK ?? '',
        agent.kvCacheV ?? '',
        agent.enabledTools ?? null,
        agent.enabledSkills ?? null,
        agent.toolsScope ?? '',
        agent.skillsScope ?? '',
        agent.disabledToolsets ?? null
    ]);
}
