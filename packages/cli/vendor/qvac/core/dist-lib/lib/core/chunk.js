import { CHUNK_PAYLOAD_FIELDS, ragSourcesWithinBounds } from '../../schema/qvac.js';
import { chunkTypeOrdinal } from '../../schema/indexes.js';
import { mediaKindOrdinal } from '../../schema/media-kind.js';
import { CoreError } from '../errors.js';
import { putApprovalRule } from './approval-rules.js';
import { linkAttachment } from './attachment-link.js';
import { foreignChat } from './contract/chat.js';
import { runRequestOf } from './contract/chunks.js';
import { asModelRequest, takenBySigner } from './contract/model-requests.js';
import { inProject, projectRules } from './contract/projects.js';
import { randomId } from './id.js';
import { keyRange } from './range.js';
import { runDefinition } from './shared-agents.js';
import { drivenBy, handedOff, offeredTo } from './run-driver.js';
import b4a from 'b4a';
import { AGENTS, ATTACHMENTS_BY_MEDIA_KIND, ATTACHMENTS_BY_MEDIA_KIND_ORIGIN, CHUNKS, CHUNKS_BY_CHAT, CHUNKS_BY_TYPE, HISTORY_CHUNKS, RUN_REQUESTS } from './collections.js';
export const HISTORY_CHUNK_TYPES = [
    'user-message',
    'run-request',
    'content',
    'attachment',
    'compaction',
    'round-reset'
];
function linkChunks(store, chunks) {
    const mint = store.attachmentUrl;
    if (!mint) {
        return chunks;
    }
    return chunks.map((chunk) => chunk.attachment ? { ...chunk, attachment: linkAttachment(mint, chunk.attachment) } : chunk);
}
export async function recordLinks(store, chunks) {
    await store.fileIndex?.record(chunks.filter((chunk) => chunk.attachment?.url));
    return chunks;
}
export function findChunksOfType(snap, { chatId, type, ...bounds }) {
    const prefix = { chatId, type: chunkTypeOrdinal(type) };
    return snap
        .find(CHUNKS_BY_TYPE, keyRange(prefix, 'seq', bounds))
        .toArray();
}
export async function listChunks(store, { chatId, type, types, ...bounds }) {
    const selected = selectedChunkTypes(type, types);
    if (selected?.length === 0) {
        return [];
    }
    if (selected && selected.length > 1 && !isHistorySelection(selected)) {
        throw new CoreError('CHUNK_TYPES_UNMAPPED');
    }
    const snap = store.view.snapshot();
    try {
        if (selected?.length === 1) {
            const prefix = { chatId, type: chunkTypeOrdinal(selected[0]) };
            const chunks = await snap
                .find(CHUNKS_BY_TYPE, keyRange(prefix, 'seq', bounds))
                .toArray();
            return linkChunks(store, chunks);
        }
        const chunks = await snap
            .find(selected ? HISTORY_CHUNKS : CHUNKS_BY_CHAT, keyRange({ chatId }, 'seq', bounds))
            .toArray();
        return linkChunks(store, chunks);
    }
    finally {
        await snap.close();
    }
}
export async function listAttachmentsByKind(store, { kind, origin, ...bounds }) {
    const mediaKind = mediaKindOrdinal(kind);
    const snap = store.view.snapshot();
    try {
        if (origin === undefined) {
            const chunks = await snap
                .find(ATTACHMENTS_BY_MEDIA_KIND, keyRange({ mediaKind }, 'createdAt', bounds))
                .toArray();
            return linkChunks(store, chunks);
        }
        const generated = origin === 'generated' ? 1 : 0;
        const chunks = await snap
            .find(ATTACHMENTS_BY_MEDIA_KIND_ORIGIN, keyRange({ mediaKind, generated }, 'createdAt', bounds))
            .toArray();
        return linkChunks(store, chunks);
    }
    finally {
        await snap.close();
    }
}
function selectedChunkTypes(type, types) {
    if (!type && types === undefined)
        return null;
    const selected = new Set(types);
    if (type) {
        selected.add(type);
    }
    return [...selected];
}
function isHistorySelection(types) {
    return (types.length === HISTORY_CHUNK_TYPES.length &&
        types.every((type) => HISTORY_CHUNK_TYPES.includes(type)));
}
export async function getChunk(store, id) {
    const snap = store.view.snapshot();
    try {
        const chunk = await snap.get(CHUNKS, { id });
        return chunk;
    }
    finally {
        await snap.close();
    }
}
export async function mustGetChunk(store, id) {
    const chunk = await getChunk(store, id);
    if (!chunk) {
        throw new CoreError('CHUNK_NOT_FOUND', [id]);
    }
    return chunk;
}
function assertPayloadMatchesType(type, payload) {
    const field = CHUNK_PAYLOAD_FIELDS[type];
    for (const candidate of Object.values(CHUNK_PAYLOAD_FIELDS)) {
        if ((payload[candidate] !== null && payload[candidate] !== undefined) ===
            (candidate === field)) {
            continue;
        }
        throw new CoreError('CHUNK_PAYLOAD_INVALID', [`${type} carries ${field} and nothing else`]);
    }
}
export async function requireChatIn(store, chatId) {
    if (store.role === 'project' && (await foreignChat(store.view, chatId))) {
        throw new CoreError('CHAT_NOT_FOUND', [chatId]);
    }
}
function projectRun(store) {
    return store.role === 'project' ? projectRules(store.view) : Promise.resolve(false);
}
async function ourMember(store) {
    return store.ourMemberId ?? (await store.refreshOurMember())?.memberId;
}
export async function ownedByUs(store, chunk) {
    const ours = await ourMember(store);
    return !!ours && !!chunk.requesterMemberId && b4a.equals(ours, chunk.requesterMemberId);
}
export async function requireProjectMember(store, meshId) {
    if (!(await projectRun(store))) {
        return;
    }
    const ours = await ourMember(store);
    if (!ours || !(await inProject(store.view, ours))) {
        throw new CoreError('PROJECT_NOT_FOUND', [meshId]);
    }
}
async function projectRunRequest(store, chatId, runId) {
    if (!(await projectRun(store))) {
        return null;
    }
    const request = await runRequestOf(store.view, chatId, runId);
    if (!request) {
        throw new CoreError('RUN_NOT_FOUND', [runId]);
    }
    return request;
}
export async function answersRound(store, parentId) {
    return !!parentId && !!asModelRequest(await getChunk(store, parentId));
}
export async function requireOwnRun(store, chatId, runId) {
    const request = await projectRunRequest(store, chatId, runId);
    if (request && !(await ownedByUs(store, request))) {
        throw new CoreError('RUN_NOT_OURS', [runId]);
    }
}
export async function requireStoppableRun(store, { meshId, chatId, runId }) {
    if (await projectRunRequest(store, chatId, runId)) {
        await requireProjectMember(store, meshId);
    }
}
async function requireRoundOutput(store, { type, runId }, parent) {
    const round = asModelRequest(parent);
    if (!round) {
        return;
    }
    if ((type !== 'content' && type !== 'thinking') || runId !== round.runId) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', [
            "only its run's content and thinking answer a model-request"
        ]);
    }
    if (!(await takenBySigner(store.view, round, store.localWriterKey))) {
        throw new CoreError('MODEL_REQUEST_NOT_OURS', [round.id]);
    }
}
async function namedHost(store, agentId) {
    const row = agentId ? await store.view.get(AGENTS, { id: agentId }) : null;
    if (row && !row.sharedIn && store.role !== 'project') {
        return row.providerDeviceId;
    }
    if (!row?.sharedIn || !(await store.pickedFrom?.())) {
        return undefined;
    }
    return (await runDefinition(store, row))?.providerDeviceId;
}
export async function appendChunk(store, { id = randomId(), chatId, runId, type, originDeviceId, parentId, effect, intent, display, rawCall, capability, capabilityArgs, enhance, senderNameAtSend, sourceId, round, callId, resumed, runnerDeviceId, ...payload }, into = store) {
    assertPayloadMatchesType(type, payload);
    if (type === 'sources' && !runId) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['a sources chunk requires runId']);
    }
    if (type === 'sources' && !ragSourcesWithinBounds(payload.sources)) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['a sources chunk exceeds its wire bounds']);
    }
    if (capability && type !== 'run-request') {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['only a run-request carries a capability']);
    }
    if (runnerDeviceId && (type !== 'run-request' || capability)) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['only a run-request for an agent names a runner']);
    }
    if (sourceId && type !== 'attachment') {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['only an attachment is derived from another']);
    }
    if (type === 'user-message' && !store.ourMemberId) {
        await store.refreshOurMember();
    }
    if (type === 'agent-switch' && (runId || parentId)) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', ['an agent-switch belongs to the chat, not a run']);
    }
    if ((type === 'context' || type === 'model-request') && !runId) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', [`a ${type} chunk requires runId`]);
    }
    if ((type === 'context' || type === 'model-request') &&
        !(store.ourDeviceId && b4a.equals(store.ourDeviceId, originDeviceId))) {
        throw new CoreError('CHUNK_PAYLOAD_INVALID', [
            `a ${type} chunk is written by its origin device`
        ]);
    }
    if (parentId) {
        const parent = await getChunk(store, parentId);
        if (!parent || parent.chatId !== chatId) {
            throw new CoreError('CHUNK_PAYLOAD_INVALID', [
                `parentId is not a chunk in this chat: ${parentId}`
            ]);
        }
        await requireRoundOutput(store, { type, runId }, parent);
    }
    const senderMemberId = type === 'user-message' && store.ourDeviceId && b4a.equals(store.ourDeviceId, originDeviceId)
        ? store.ourMemberId || undefined
        : undefined;
    const op = {
        id,
        chatId,
        runId,
        type,
        originDeviceId,
        parentId,
        effect,
        intent,
        display,
        rawCall,
        capability,
        capabilityArgs,
        enhance,
        sourceId,
        round,
        callId,
        resumed,
        runnerDeviceId,
        createdAt: Date.now(),
        senderMemberId,
        senderNameAtSend: senderMemberId ? senderNameAtSend : undefined,
        ...payload
    };
    if (op.modelRequest && runId) {
        const host = await namedHost(store, op.modelRequest.agents?.[0]);
        op.modelRequest = { ...op.modelRequest, hostDeviceId: host };
    }
    await into.dispatch('append-chunk', op);
    if (type === 'attachment') {
        await store.fileIndex?.record([op]);
    }
    return { id };
}
export async function updateChunk(store, { id, runStatus, attachment }) {
    const chunk = await mustGetChunk(store, id);
    await store.dispatch('update-chunk', updateOp(chunk, { id, runStatus, attachment }));
    const updated = await mustGetChunk(store, id);
    return updated;
}
export function updateOp(chunk, { id, runStatus, attachment }) {
    if (chunk.type === 'run-status' &&
        runStatus !== null &&
        runStatus !== undefined &&
        (attachment === null || attachment === undefined)) {
        return { id, runStatus, updatedAt: Date.now() };
    }
    if (chunk.type === 'attachment' &&
        attachment !== null &&
        attachment !== undefined &&
        (runStatus === null || runStatus === undefined)) {
        return { id, attachment, updatedAt: Date.now() };
    }
    throw new CoreError('CHUNK_PAYLOAD_INVALID', [
        'a run-status edits runStatus, an attachment edits attachment'
    ]);
}
const DEFAULT_APPROVAL_RULE_TTL_MS = 60 * 60 * 1000;
export async function othersApproval(store, id) {
    const ask = await getChunk(store, id);
    return !!ask && (await projectRun(store)) && !(await ownedByUs(store, ask));
}
export async function resolveApproval(store, { id, approved, scope, expiresAt, agentId }, rules = store) {
    const before = await getChunk(store, id);
    const wasPending = before?.type === 'approval-request' && before.approvalRequest?.status === 'pending';
    await store.dispatch('resolve-approval', { id, approved, resolvedAt: Date.now() });
    const resolved = await mustGetChunk(store, id);
    if (rules && scope === 'always' && wasPending) {
        const ask = resolved.approvalRequest;
        if (ask && (ask.status === 'approved' || ask.status === 'denied')) {
            await putApprovalRule(rules, {
                toolName: ask.name,
                resourceKind: ask.resource?.kind ?? undefined,
                resourcePattern: ask.resource?.label ?? undefined,
                decision: ask.status === 'approved' ? 'allow' : 'deny',
                expiresAt: expiresAt ?? Date.now() + DEFAULT_APPROVAL_RULE_TTL_MS,
                agentId: ask.agentId ?? agentId,
                effect: resolved.effect ?? undefined
            });
        }
    }
    return resolved;
}
export async function listRunRequests(store, deviceId) {
    if (!deviceId)
        return [];
    const project = await projectRun(store);
    const snap = store.view.snapshot();
    try {
        const requests = await snap.find(RUN_REQUESTS).toArray();
        const agents = new Map();
        const mine = [];
        for (const request of requests) {
            if (store.closing)
                return mine;
            const agentId = request.runRequest?.agentId;
            if (!agentId || (project && !(await ownedByUs(store, request)))) {
                continue;
            }
            if (!agents.has(agentId)) {
                agents.set(agentId, await runDefinition(store, await snap.get(AGENTS, { id: agentId })));
            }
            const agent = agents.get(agentId);
            const listed = offeredTo(request, deviceId) || handedOff(request, deviceId);
            if (agent && (listed || drivenBy({ request, agent }, deviceId))) {
                mine.push(request);
            }
        }
        return mine;
    }
    finally {
        await snap.close();
    }
}
