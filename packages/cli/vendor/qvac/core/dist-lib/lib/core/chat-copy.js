import b4a from 'b4a';
import { PENDING_BLOB_REFERENCE, isPendingBlobReference, parseBlobReference } from './files/store/index.js';
import { CoreError } from '../errors.js';
import { inlineReference } from './files/store/inline.js';
import { TERMINAL_RUN_STATES } from './chat.js';
import { appendChunk, ownedByUs, updateOp } from './chunk.js';
import { runRequestOf } from './contract/chunks.js';
import { ACTIVE_AGENTS, AGENTS, CHATS, CHAT_GROUPS, CHUNKS, CHUNKS_BY_CHAT, DEVICES, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, KNOWLEDGE_BY_CHAT, PURGED_CHATS, TOOL_ACTIVITY } from './collections.js';
const UNCOPIED = new Set(['context', 'model-request']);
export async function copyChunks(snap, chatId, { from, into }) {
    const batch = into.batch();
    for (const chunk of await chunksOf(snap, chatId)) {
        if (await into.view.get(CHUNKS, { id: chunk.id }))
            continue;
        const { seq, updatedAt, attachment, runnerDeviceId, ...op } = stripped(chunk);
        if (!attachment) {
            batch.dispatch('append-chunk', op);
            continue;
        }
        const blobId = await copyBlob(from, into, attachment.blobId);
        if (!blobId) {
            continue;
        }
        batch.dispatch('append-chunk', { ...op, attachment: { ...attachment, blobId } });
        await batch.flush();
        await into.fileIndex?.record([{ ...chunk, attachment: { ...attachment, blobId } }]);
    }
    await batch.flush();
}
export async function copyMovedChunks(snap, chatId, copy) {
    const { into, originDeviceId } = copy;
    const result = { copied: 0, open: new Set(), withheld: 0 };
    const batch = into.batch();
    const open = new Set();
    const files = [];
    const chunks = await chunksOf(snap, chatId);
    const runs = runsOf(chunks);
    for (const chunk of chunks) {
        if (await heldInTarget(into, { collection: CHUNKS, id: chunk.id, chatId: copy.chatId })) {
            continue;
        }
        if (chunk.runId && runs.open.has(chunk.runId)) {
            result.open.add(chunk.runId);
            continue;
        }
        if (chunk.runId && !runs.requested.has(chunk.runId) && into.role === 'project') {
            continue;
        }
        if (await othersRun(into, { ...chunk, chatId: copy.chatId })) {
            result.withheld++;
            continue;
        }
        const { seq, updatedAt, attachment, runnerDeviceId, ...op } = stripped(chunk);
        const at = { ...op, chatId: copy.chatId, senderMemberId: sentBy(chunk) };
        result.copied++;
        trackOpen(open, chunk);
        if (!attachment) {
            batch.dispatch('append-chunk', at);
        }
        else {
            const blobId = attachment.deletedAt
                ? removedReference(attachment)
                : await movedBlob(copy, attachment);
            const moved = { ...at, originDeviceId, attachment: { ...attachment, blobId } };
            batch.dispatch('append-chunk', moved);
            if (!isPendingBlobReference(blobId)) {
                files.push({ ...chunk, ...moved });
            }
        }
        if (files.length > 0 && open.size === 0) {
            await batch.flush();
            await into.fileIndex?.record(files.splice(0));
        }
    }
    await batch.flush();
    if (files.length > 0) {
        await into.fileIndex?.record(files);
    }
    return result;
}
function runsOf(chunks) {
    const requested = new Set();
    const settled = new Set();
    for (const chunk of chunks) {
        if (!chunk.runId)
            continue;
        if (chunk.type === 'run-request') {
            requested.add(chunk.runId);
        }
        else if (TERMINAL_RUN_STATES.has(chunk.runStatus?.state ?? '')) {
            settled.add(chunk.runId);
        }
    }
    return { requested, open: new Set([...requested].filter((runId) => !settled.has(runId))) };
}
function trackOpen(open, chunk) {
    if (!chunk.runId)
        return;
    if (chunk.type === 'run-request') {
        open.add(chunk.runId);
    }
    else if (TERMINAL_RUN_STATES.has(chunk.runStatus?.state ?? '')) {
        open.delete(chunk.runId);
    }
}
async function othersRun(into, { chatId, runId }) {
    const request = runId ? await runRequestOf(into.view, chatId, runId) : null;
    return !!request?.requesterMemberId && !(await ownedByUs(into, request));
}
export function sentBy(chunk) {
    const writer = chunk.type === 'user-message' ? chunk.requesterMemberId : undefined;
    return chunk.senderMemberId ?? writer ?? undefined;
}
export async function copyMovedKnowledge(snap, chatId, copy) {
    const batch = copy.into.batch();
    const inChat = { gte: { chatId }, lte: { chatId } };
    for (const row of await snap.find(KNOWLEDGE_BY_CHAT, inChat).toArray()) {
        if (await heldInTarget(copy.into, { collection: KNOWLEDGE, id: row.id, chatId: copy.chatId })) {
            continue;
        }
        const blobId = row.deletedAt ? removedReference(row) : await movedBlob(copy, row);
        if (isPendingBlobReference(blobId)) {
            continue;
        }
        batch.dispatch('add-knowledge', {
            knowledge: { ...stripped(row), chatId: copy.chatId, blobId }
        });
    }
    await batch.flush();
}
export async function movedBlob({ from, into, references }, { blobId }) {
    const known = references.get(blobId);
    if (known) {
        return known;
    }
    const moved = (await copyBlob(from, into, blobId)) ?? PENDING_BLOB_REFERENCE;
    if (!isPendingBlobReference(moved)) {
        references.set(blobId, moved);
    }
    return moved;
}
export function removedReference({ mimeType }) {
    return inlineReference(b4a.alloc(0), mimeType);
}
async function heldInTarget(into, { collection, id, chatId }) {
    const existing = await into.view.get(collection, { id });
    if (existing && existing.chatId !== chatId) {
        throw new CoreError('CHAT_MOVE_ID_CONFLICT');
    }
    return !!existing;
}
export async function chunksOf(snap, chatId) {
    const all = await snap
        .find(CHUNKS_BY_CHAT, { gte: { chatId }, lte: { chatId } })
        .toArray();
    const rounds = new Set(all.filter((chunk) => UNCOPIED.has(chunk.type)).map(({ id }) => id));
    return all
        .filter((chunk) => !rounds.has(chunk.id))
        .map((chunk) => chunk.parentId && rounds.has(chunk.parentId) ? { ...chunk, parentId: null } : chunk);
}
export async function copyBlob(from, into, reference) {
    let bytes;
    try {
        if (parseBlobReference(reference).inline) {
            return reference;
        }
        bytes = await from.files.readBytes(reference, { wait: false });
    }
    catch {
        return null;
    }
    return (await into.files.put(bytes)).reference;
}
export function stripped(row) {
    const { version: _version, ...rest } = row;
    return rest;
}
export async function copyContent(copy) {
    await copy.into.autobee.update();
    await copy.from.autobee.update();
    const snap = copy.from.view.snapshot();
    try {
        const remap = await defaultAgentRemap(snap, copy.into);
        const chats = await copyRows(snap, copy, remap);
        const references = new Map();
        for (const chat of chats) {
            await copyChatChunks(snap, chat.id, { ...copy, references });
        }
        await copyFiles(snap, { ...copy, references });
        await copyToolActivity(snap, copy);
    }
    finally {
        await snap.close();
    }
}
async function defaultAgentRemap(snap, into) {
    const remap = new Map();
    const target = (await into.view.find(ACTIVE_AGENTS).toArray()).find((a) => a.isDefault);
    if (!target) {
        return remap;
    }
    for (const agent of await snap.find(ACTIVE_AGENTS).toArray()) {
        if (agent.isDefault && agent.id !== target.id) {
            remap.set(agent.id, { id: target.id, seededAt: agent.createdAt });
        }
    }
    return remap;
}
async function copyRows(snap, copy, remap) {
    const { into } = copy;
    const batch = into.batch();
    const chats = await copiedChats(snap, copy);
    await copyAgentsAndGroups(snap, { into, batch, remap, chats, ungroup: !!copy.chats });
    const live = [];
    for (const chat of chats) {
        const agent = remap.get(chat.agentId);
        if (agent && (await seededChat(snap, chat, agent))) {
            continue;
        }
        if (!chat.deletedAt) {
            live.push(chat);
        }
        if (await newer(into, CHATS, chat)) {
            const groupId = copy.chats ? undefined : chat.groupId;
            const projectId = copy.unlinkProjects ? undefined : chat.projectId;
            batch.dispatch('put-chat', {
                chat: { ...stripped(chat), agentId: agent?.id ?? chat.agentId, groupId, projectId }
            });
        }
    }
    const purged = copy.chats ? [] : await snap.find(PURGED_CHATS).toArray();
    for (const row of purged) {
        if (!(await into.view.get(PURGED_CHATS, { chatId: row.chatId }))) {
            batch.dispatch('purge-chat', { chatId: row.chatId, at: row.at });
        }
    }
    await batch.flush();
    return live;
}
async function copiedChats(snap, { chats }) {
    const all = await snap.find(CHATS).toArray();
    return chats ? all.filter((chat) => chats.has(chat.id) && !chat.deletedAt) : all;
}
async function copyAgentsAndGroups(snap, { into, batch, remap, chats, ungroup }) {
    const used = new Set(chats.map((chat) => chat.agentId));
    for (const agent of await snap.find(AGENTS).toArray()) {
        if (used.has(agent.id) && !remap.has(agent.id) && (await newer(into, AGENTS, agent))) {
            batch.dispatch('put-agent', { agent: stripped(agent) });
        }
    }
    const groups = ungroup ? [] : await snap.find(CHAT_GROUPS).toArray();
    for (const group of groups) {
        if (await newer(into, CHAT_GROUPS, group)) {
            batch.dispatch('put-chat-group', { group: stripped(group) });
        }
    }
}
async function seededChat(snap, chat, agent) {
    return chat.createdAt === agent.seededAt && (await chunksOf(snap, chat.id)).length === 0;
}
async function newer(into, collection, row) {
    const held = await into.view.get(collection, { id: row.id });
    return !held || (held.updatedAt ?? 0) < (row.updatedAt ?? 0);
}
async function copyChatChunks(snap, chatId, copy) {
    const { into } = copy;
    const batch = into.batch();
    const chunks = await chunksOf(snap, chatId);
    const open = copy.chats ? runsOf(chunks).open : new Set();
    for (const chunk of chunks) {
        const held = await into.view.get(CHUNKS, { id: chunk.id });
        if (held) {
            await batch.flush();
            await updateHeldChunk(chunk, held, copy);
            continue;
        }
        const { seq, updatedAt, attachment, runnerDeviceId, ...rest } = stripped(chunk);
        const op = copy.chats ? { ...rest, senderMemberId: await senderOf(snap, chunk) } : rest;
        if (!attachment) {
            batch.dispatch('append-chunk', op);
            if (chunk.type === 'run-request' && chunk.runId && open.has(chunk.runId)) {
                await endUpgradedRun(chunk, copy, batch);
            }
            continue;
        }
        const blobId = attachment.deletedAt
            ? removedReference(attachment)
            : await movedBlob(moveOf(copy), attachment);
        const copied = { ...op, attachment: { ...attachment, blobId } };
        batch.dispatch('append-chunk', copied);
        await batch.flush();
        if (!isPendingBlobReference(blobId)) {
            await into.fileIndex?.record([{ ...chunk, ...copied }]);
        }
    }
    await batch.flush();
}
export const UPGRADED_RUN_REASON = 'the app was updated before this was answered, send it again';
async function endUpgradedRun(request, copy, batch) {
    await appendChunk(copy.into, {
        chatId: request.chatId,
        runId: request.runId,
        type: 'run-status',
        runStatus: { state: 'failed', reason: UPGRADED_RUN_REASON },
        originDeviceId: copy.deviceId
    }, batch);
}
async function senderOf(snap, chunk) {
    if (chunk.type !== 'user-message') {
        return undefined;
    }
    const device = await snap.get(DEVICES, { id: chunk.originDeviceId });
    return sentBy(chunk) ?? device?.memberId ?? undefined;
}
async function updateHeldChunk(chunk, held, copy) {
    if (!b4a.equals(chunk.originDeviceId, copy.deviceId))
        return;
    const { into } = copy;
    if (chunk.runStatus) {
        if (newerEdit(chunk, held)) {
            const op = updateOp(chunk, { id: chunk.id, runStatus: chunk.runStatus });
            await into.dispatch('update-chunk', op);
        }
        return;
    }
    const attachment = await repointed(chunk, held, copy);
    if (attachment) {
        await into.dispatch('update-chunk', updateOp(chunk, { id: chunk.id, attachment }));
        await into.fileIndex?.record([{ ...chunk, attachment }]);
    }
}
async function repointed(chunk, held, copy) {
    const attachment = chunk.attachment;
    if (!attachment || !held.attachment || held.attachment.deletedAt) {
        return null;
    }
    if (attachment.deletedAt) {
        return newerEdit(chunk, held) ? { ...attachment, blobId: removedReference(attachment) } : null;
    }
    if (isPendingBlobReference(held.attachment.blobId)) {
        const blobId = await movedBlob(moveOf(copy), attachment);
        return isPendingBlobReference(blobId) ? null : { ...attachment, blobId };
    }
    return newerEdit(chunk, held) ? { ...attachment, blobId: held.attachment.blobId } : null;
}
function newerEdit(chunk, held) {
    return (chunk.updatedAt ?? 0) > (held.updatedAt ?? 0);
}
function moveOf({ from, into, deviceId, references }) {
    return { from, into, chatId: '', originDeviceId: deviceId, references };
}
async function copyFiles(snap, copy) {
    const { from, into, chats } = copy;
    const batch = into.batch();
    const rows = await snap.find(KNOWLEDGE).toArray();
    const copied = chats ? rows.filter((row) => !!row.chatId && chats.has(row.chatId)) : rows;
    const ids = new Set(copied.map((row) => row.id));
    for (const row of copied) {
        if (await into.view.get(KNOWLEDGE, { id: row.id })) {
            continue;
        }
        const blobId = row.deletedAt ? removedReference(row) : await movedBlob(moveOf(copy), row);
        if (!isPendingBlobReference(blobId)) {
            batch.dispatch('add-knowledge', { knowledge: { ...stripped(row), blobId } });
        }
    }
    await batch.flush();
    for (const row of await snap.find(KNOWLEDGE_ARTIFACTS).toArray()) {
        if (chats && !ids.has(row.knowledgeId)) {
            continue;
        }
        if (await into.view.get(KNOWLEDGE_ARTIFACTS, { id: row.id })) {
            continue;
        }
        const artifactBlobId = await copyBlob(from, into, row.artifactBlobId);
        if (artifactBlobId) {
            batch.dispatch('add-knowledge-artifact', { artifact: { ...stripped(row), artifactBlobId } });
        }
    }
    await batch.flush();
}
async function copyToolActivity(snap, { into, chats }) {
    const batch = into.batch();
    for (const row of await snap.find(TOOL_ACTIVITY).toArray()) {
        if (chats && !(row.chatId && chats.has(row.chatId))) {
            continue;
        }
        if (await into.view.get(TOOL_ACTIVITY, { id: row.id })) {
            continue;
        }
        const { seq: _seq, ...activity } = stripped(row);
        batch.dispatch('append-tool-activity', { activity });
    }
    await batch.flush();
}
