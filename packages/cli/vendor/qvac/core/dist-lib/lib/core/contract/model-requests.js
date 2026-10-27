import b4a from 'b4a';
import { chunkTypeOrdinal } from '../../../schema/indexes.js';
import { liveDeviceForWriter, trackActivity } from './activity.js';
import { projectRules } from './projects.js';
import { isProbeRound } from '../../probe-rounds.js';
import { derivedId } from '../id.js';
import { AGENT_HOSTS, CHUNK_COUNTERS, CHUNKS, CHUNKS_BY_TYPE, DEVICES, RUN_REQUEST_BY_RUN } from '../collections.js';
const ROUND_CHUNKS = new Set(['context', 'model-request']);
const ROUND_OUTPUT = new Set(['content', 'thinking']);
const SETTLED = new Set(['done', 'failed']);
const LIVE = new Set(['open', 'taken']);
const HOST_ROUTES = new Set([
    '@qvac/agent-join',
    '@qvac/take-model-request',
    '@qvac/settle-model-request',
    '@qvac/append-chunk',
    '@qvac/remove-writer'
]);
export function asModelRequest(chunk) {
    const modelRequest = chunk?.type === 'model-request' ? chunk.modelRequest : null;
    return chunk && modelRequest ? { ...chunk, modelRequest } : null;
}
async function modelRequestOf(tx, id) {
    return asModelRequest(await tx.get(CHUNKS, { id }));
}
export async function ownerSigner(tx, request, writerKey) {
    const signer = await liveDeviceForWriter(tx, writerKey);
    if (!signer || b4a.equals(signer.id, request.originDeviceId)) {
        return signer;
    }
    const origin = await tx.get(DEVICES, { id: request.originDeviceId });
    const owner = request.requesterMemberId ?? origin?.memberId;
    return owner && signer.memberId && b4a.equals(owner, signer.memberId) ? signer : null;
}
export async function hostForWriter(db, writerKey) {
    const range = { gte: { writerKey }, lte: { writerKey } };
    const host = await db.findOne(AGENT_HOSTS, range);
    return host && !(await liveDeviceForWriter(db, writerKey)) ? host : null;
}
async function hostsAny(tx, writerKey, agents) {
    for (const agentId of agents ?? []) {
        if (await tx.get(AGENT_HOSTS, { writerKey, agentId })) {
            return true;
        }
    }
    return false;
}
export async function takerFor(tx, request, writerKey) {
    const { hostDeviceId, agents } = request.modelRequest;
    const host = await hostForWriter(tx, writerKey);
    if (host) {
        const named = hostDeviceId && b4a.equals(host.deviceId, hostDeviceId);
        return named && (await hostsAny(tx, writerKey, agents)) ? host.deviceId : null;
    }
    if (hostDeviceId) {
        const device = await liveDeviceForWriter(tx, writerKey);
        return device && b4a.equals(device.id, hostDeviceId) ? device.id : null;
    }
    return (await ownerSigner(tx, request, writerKey))?.id ?? null;
}
export async function takenBySigner(tx, request, writerKey) {
    const { state, takenBy } = request.modelRequest;
    if (state !== 'taken' || !takenBy) {
        return false;
    }
    const signer = (await liveDeviceForWriter(tx, writerKey))?.id ?? (await hostForWriter(tx, writerKey))?.deviceId;
    return !!signer && b4a.equals(signer, takenBy);
}
export async function appendRow(tx, row) {
    const counter = await tx.get(CHUNK_COUNTERS, { chatId: row.chatId });
    const seq = counter?.count ?? 0;
    await tx.insert(CHUNK_COUNTERS, {
        chatId: row.chatId,
        count: seq + 1,
        lastActivityAt: Math.max(counter?.lastActivityAt ?? 0, row.createdAt)
    });
    const appended = { ...row, seq };
    await tx.insert(CHUNKS, appended);
    return appended;
}
async function resetRound(tx, request, { node, by, at }) {
    if (isProbeRound(request.modelRequest.options)) {
        return;
    }
    await appendRow(tx, {
        id: derivedId('round-reset', b4a.toHex(node.key), String(node.length)),
        chatId: request.chatId,
        runId: request.runId,
        type: 'round-reset',
        round: request.modelRequest.round,
        roundReset: { replacedTypes: ['content', 'thinking'] },
        originDeviceId: by,
        requesterMemberId: request.requesterMemberId,
        createdAt: at
    });
}
function moved(request, modelRequest, at) {
    return { ...request, modelRequest, updatedAt: Math.max(request.updatedAt ?? 0, at) };
}
async function firstRunRequest(tx, chatId, runId) {
    const run = { chatId, runId };
    const asks = await tx.find(RUN_REQUEST_BY_RUN, { gte: run, lte: run }).toArray();
    return asks.reduce((first, ask) => (first && first.seq <= ask.seq ? first : ask), null);
}
export async function roundChunkRefusal(op, { tx, node }) {
    if (!ROUND_CHUNKS.has(op.type)) {
        return null;
    }
    if (!op.runId) {
        return 'a context or model-request chunk requires runId';
    }
    const signer = await liveDeviceForWriter(tx, node.key);
    if (!signer || !b4a.equals(signer.id, op.originDeviceId)) {
        return 'a context or model-request chunk is written by its origin device';
    }
    if (op.type !== 'model-request' || (await projectRules(tx))) {
        return null;
    }
    const ask = await firstRunRequest(tx, op.chatId, op.runId);
    const asker = ask && (await tx.get(DEVICES, { id: ask.originDeviceId }));
    return asker?.memberId && signer.memberId && b4a.equals(asker.memberId, signer.memberId)
        ? null
        : "a round belongs to a run of its signer's member";
}
export function openRound(op) {
    if (!op.modelRequest) {
        return op;
    }
    const { round, agents, options, toolTurns, cacheKey, promptPrefix, hostDeviceId } = op.modelRequest;
    return {
        ...op,
        modelRequest: {
            round,
            agents,
            options,
            toolTurns,
            cacheKey,
            promptPrefix,
            hostDeviceId,
            state: 'open'
        }
    };
}
export async function outputRefusal(op, request, { tx, node }) {
    if (isProbeRound(request.modelRequest.options)) {
        return "a probe's answer is its settled result, never a chunk";
    }
    if (!ROUND_OUTPUT.has(op.type)) {
        return 'only content and thinking answer a model-request';
    }
    if (op.runId !== request.runId) {
        return "a model-request's output carries its runId";
    }
    return (await takenBySigner(tx, request, node.key))
        ? null
        : "a model-request's output is written by its current taker";
}
export function served(request, at) {
    return moved(request, request.modelRequest, at);
}
export async function closeRounds(tx, { chatId, runId, at }) {
    const type = chunkTypeOrdinal('model-request');
    const rounds = await tx
        .find(CHUNKS_BY_TYPE, {
        gte: { chatId, type },
        lte: { chatId, type }
    })
        .toArray();
    for (const chunk of rounds) {
        const request = asModelRequest(chunk);
        if (request?.runId === runId && LIVE.has(request.modelRequest.state)) {
            await tx.insert(CHUNKS, moved(request, { ...request.modelRequest, state: 'cancelled' }, at));
        }
    }
}
export async function hostOutputRefusal(op, round, { tx, node }) {
    const host = await hostForWriter(tx, node.key);
    if (!host) {
        return null;
    }
    if (!ROUND_OUTPUT.has(op.type)) {
        return 'a model host writes only content and thinking';
    }
    if (!b4a.equals(op.originDeviceId, host.deviceId)) {
        return "a model host's output names it as origin";
    }
    return round ? null : "a model host's output answers a model-request";
}
export function modelOutputOnly(router) {
    return {
        add: (name, handler) => router.add(name, async (op, context) => {
            if (HOST_ROUTES.has(name) || !(await hostForWriter(context.tx, context.node.key))) {
                return handler(op, context);
            }
            context.log?.warn('contract', `${name} dropped: a model host writes only model output`);
        })
    };
}
export function registerModelRequestRoutes(router) {
    router.add('@qvac/take-model-request', trackActivity(async (op, { tx, node, log }) => {
        const request = await modelRequestOf(tx, op.id);
        const { state, takenBy: held, takenAt } = request?.modelRequest ?? {};
        const retake = state === 'taken' && !!request && (await takenBySigner(tx, request, node.key));
        if (!request || (state !== 'open' && !retake)) {
            log?.debug('contract', 'take-model-request dropped: no open model-request', { id: op.id });
            return;
        }
        const takenBy = await takerFor(tx, request, node.key);
        if (!takenBy || (retake && held && !b4a.equals(takenBy, held))) {
            log?.warn('contract', 'take-model-request dropped: no owner device or agent host', {
                id: op.id
            });
            return;
        }
        const at = retake ? Math.max(op.at, (takenAt ?? 0) + 1) : op.at;
        if (retake) {
            await resetRound(tx, request, { node, by: takenBy, at });
        }
        const taken = moved(request, { ...request.modelRequest, state: 'taken', takenBy, takenAt: at }, at);
        await tx.insert(CHUNKS, taken);
        return taken;
    }));
    router.add('@qvac/settle-model-request', trackActivity(async (op, context) => {
        const { tx, node, log } = context;
        const request = await modelRequestOf(tx, op.id);
        if (!request || !(await takenBySigner(tx, request, node.key))) {
            log?.warn('contract', 'settle-model-request dropped: only its current taker settles it', {
                id: op.id
            });
            return;
        }
        if (!SETTLED.has(op.state)) {
            log?.warn('contract', 'settle-model-request dropped: a round settles done or failed', {
                id: op.id
            });
            return;
        }
        const settled = moved(request, { ...request.modelRequest, state: op.state, result: op.result, reason: op.reason }, op.at);
        await tx.insert(CHUNKS, settled);
        return settled;
    }));
    router.add('@qvac/cancel-model-request', trackActivity(async (op, { tx, node, log }) => {
        const request = await modelRequestOf(tx, op.id);
        if (!request || !LIVE.has(request.modelRequest.state)) {
            log?.debug('contract', 'cancel-model-request dropped: no live model-request', { id: op.id });
            return;
        }
        if (!(await ownerSigner(tx, request, node.key))) {
            log?.warn('contract', "cancel-model-request dropped: only the run owner's devices cancel", {
                id: op.id
            });
            return;
        }
        const cancelled = moved(request, { ...request.modelRequest, state: 'cancelled' }, op.at);
        await tx.insert(CHUNKS, cancelled);
        return cancelled;
    }));
    router.add('@qvac/reopen-model-request', trackActivity(async (op, { tx, node, log }) => {
        const request = await modelRequestOf(tx, op.id);
        if (request?.modelRequest.state !== 'taken') {
            log?.debug('contract', 'reopen-model-request dropped: no taken model-request', {
                id: op.id
            });
            return;
        }
        const owner = await ownerSigner(tx, request, node.key);
        if (!owner) {
            log?.warn('contract', "reopen-model-request dropped: only its owner's devices reopen", {
                id: op.id
            });
            return;
        }
        await resetRound(tx, request, { node, by: owner.id, at: op.at });
        const { takenBy: _takenBy, takenAt: _takenAt, ...ask } = request.modelRequest;
        const reopened = moved(request, { ...ask, state: 'open' }, op.at);
        await tx.insert(CHUNKS, reopened);
        return reopened;
    }));
}
