import b4a from 'b4a';
import { CoreError } from '../errors.js';
import { landingAgentId, mustGetActiveAgent } from './agent.js';
import { TERMINAL_RUN_STATES, enrichChat, listSidebar } from './chat.js';
import { chunksOf, copyBlob, removedReference, sentBy, stripped } from './chat-copy.js';
import { chatSortKey } from './chat-order.js';
import { isPendingBlobReference } from './files/index.js';
import { groupAttachmentsByMessage } from './files/records/linkage.js';
import { derivedId, randomId } from './id.js';
import { rankOnTop } from './rank.js';
import { CHATS, KNOWLEDGE_BY_CHAT } from './collections.js';
export async function forkChat(meshes, input) {
    const { into } = meshes;
    if (!into.writable) {
        throw new CoreError('CHAT_TARGET_NOT_WRITER');
    }
    const plan = await forkPlan(meshes, input);
    const batch = into.batch();
    batch.dispatch('put-chat', { chat: plan.chat });
    for (const chunk of plan.chunks) {
        batch.dispatch('append-chunk', chunk);
    }
    const memberId = into.ourMemberId;
    if (memberId && plan.chunks.length > 0) {
        batch.dispatch('mark-chat-read', {
            chatId: plan.chat.id,
            memberId,
            readThrough: plan.chunks.length
        });
    }
    for (const knowledge of plan.knowledge) {
        batch.dispatch('add-knowledge', { knowledge });
    }
    await batch.flush();
    await into.fileIndex?.record(plan.chunks.filter((chunk) => chunk.attachment));
    return enrichChat(into, plan.chat);
}
async function forkPlan(meshes, input) {
    const snap = meshes.from.view.snapshot();
    try {
        const source = await snap.get(CHATS, { id: input.chatId });
        if (!source || source.deletedAt) {
            throw new CoreError('CHAT_NOT_FOUND', [input.chatId]);
        }
        const all = await chunksOf(snap, source.id);
        const cut = forkCut(all, input);
        const documents = await documentsOf(snap, { source, all, cut });
        const ctx = contextOf(meshes, { cut, documents, originDeviceId: input.originDeviceId });
        const agentId = await forkAgentId(ctx, { source, agentId: input.agentId });
        const chunks = await forkedChunks(ctx, cut.chunks);
        const knowledge = await forkedDocuments(ctx, documents);
        const chat = await forkedChat(ctx, { source, cut, agentId, title: input.title });
        return { chat, chunks, knowledge };
    }
    finally {
        await snap.close();
    }
}
function forkCut(chunks, input) {
    const requests = chunks.filter((chunk) => chunk.type === 'run-request' && chunk.runId);
    const finished = finishedRuns(chunks);
    const end = input.runId ? endAt(requests, input) : settledEnd(requests, finished);
    const included = requests.slice(0, end);
    if (included.some((request) => !finished.has(request.runId ?? ''))) {
        throw new CoreError('CHAT_FORK_TURN_RUNNING');
    }
    const turns = new Set(requests.map((request) => request.runId));
    const runs = new Set(included.map((request) => request.runId));
    const next = requests[end];
    const from = next ? turnStart(chunks, { next, included }) : Infinity;
    const kept = [];
    let before = Infinity;
    for (const chunk of chunks) {
        if (turns.has(chunk.runId) ? runs.has(chunk.runId) : chunk.seq < from) {
            kept.push(chunk);
        }
        else {
            before = Math.min(before, chunk.createdAt);
        }
    }
    return { chunks: kept, before, runId: included.at(-1)?.runId ?? undefined };
}
function endAt(requests, { runId, exclusive }) {
    const at = requests.findIndex((request) => request.runId === runId);
    if (at === -1) {
        throw new CoreError('CHAT_FORK_NO_SUCH_TURN');
    }
    const end = exclusive ? at : at + 1;
    if (end === 0) {
        throw new CoreError('CHAT_FORK_NOTHING_BEFORE');
    }
    return end;
}
function settledEnd(requests, finished) {
    const running = requests.findIndex((request) => !finished.has(request.runId ?? ''));
    if (running === 0) {
        throw new CoreError('CHAT_FORK_TURN_RUNNING');
    }
    return running === -1 ? requests.length : running;
}
function finishedRuns(chunks) {
    const runs = new Set();
    for (const chunk of chunks) {
        if (chunk.runId && TERMINAL_RUN_STATES.has(chunk.runStatus?.state ?? '')) {
            runs.add(chunk.runId);
        }
    }
    return runs;
}
function turnStart(chunks, { next, included }) {
    const messages = chunks.filter((chunk) => chunk.type === 'user-message' && !chunk.runId);
    const message = messages.findLast((chunk) => chunk.seq < next.seq);
    const answered = (included.at(-1)?.seq ?? -1) > (message?.seq ?? -1);
    if (!message || answered) {
        return next.seq;
    }
    const attachments = chunks.filter((chunk) => chunk.type === 'attachment');
    const bound = groupAttachmentsByMessage(attachments, messages).get(message.id) ?? [];
    return Math.min(message.seq, ...bound.map((chunk) => chunk.seq));
}
async function documentsOf(snap, { source, all, cut }) {
    const inChat = { gte: { chatId: source.id }, lte: { chatId: source.id } };
    const rows = await snap.find(KNOWLEDGE_BY_CHAT, inChat).toArray();
    const attached = new Set(all.map(fileIdOf));
    const carried = new Set(cut.chunks.map(fileIdOf));
    return rows.filter((row) => attached.has(row.id) ? carried.has(row.id) : row.createdAt < cut.before);
}
function fileIdOf(chunk) {
    return chunk.attachment?.id;
}
function contextOf(meshes, { cut, documents, originDeviceId }) {
    const files = cut.chunks.map(fileIdOf).filter((id) => id !== undefined);
    return {
        ...meshes,
        same: b4a.equals(meshes.from.key, meshes.into.key),
        chatId: randomId(),
        kept: new Set(cut.chunks.map((chunk) => chunk.id)),
        files: new Set([...files, ...documents.map((row) => row.id)]),
        originDeviceId,
        references: new Map()
    };
}
async function forkAgentId(ctx, { source, agentId }) {
    if (agentId) {
        return (await mustGetActiveAgent(ctx.into, agentId)).id;
    }
    return ctx.same ? source.agentId : landingAgentId(ctx.into, source.agentId);
}
function forkedId(ctx, id) {
    return derivedId(id, ctx.chatId);
}
async function forkedChunks(ctx, chunks) {
    const forked = [];
    for (const chunk of chunks) {
        const through = chunk.compaction?.throughId;
        if (through && !ctx.kept.has(through)) {
            continue;
        }
        forked.push(await forkedChunk(ctx, chunk));
    }
    return forked;
}
async function forkedChunk(ctx, chunk) {
    const { seq: _seq, updatedAt: _updatedAt, ...op } = stripped(chunk);
    const forked = {
        ...op,
        id: forkedId(ctx, chunk.id),
        chatId: ctx.chatId,
        senderMemberId: sentBy(chunk),
        runId: chunk.runId && forkedId(ctx, chunk.runId),
        parentId: chunk.parentId && ctx.kept.has(chunk.parentId) ? forkedId(ctx, chunk.parentId) : null,
        sourceId: chunk.sourceId && forkedId(ctx, chunk.sourceId),
        compaction: chunk.compaction && {
            ...chunk.compaction,
            throughId: forkedId(ctx, chunk.compaction.throughId)
        },
        sources: chunk.sources && {
            ...chunk.sources,
            sources: chunk.sources.sources.map((source) => forkedSource(ctx, source))
        }
    };
    if (!chunk.attachment) {
        return forked;
    }
    const blobId = await forkedReference(ctx, chunk.attachment);
    const attachment = { ...chunk.attachment, id: forkedId(ctx, chunk.attachment.id), blobId };
    return { ...forked, attachment, originDeviceId: ctx.originDeviceId };
}
function forkedSource(ctx, source) {
    const file = (id) => (id && ctx.files.has(id) ? forkedId(ctx, id) : id);
    return { ...source, documentId: file(source.documentId), attachmentId: file(source.attachmentId) };
}
async function forkedDocuments(ctx, rows) {
    const forked = [];
    for (const row of rows) {
        const blobId = await forkedReference(ctx, row);
        forked.push({ ...stripped(row), id: forkedId(ctx, row.id), chatId: ctx.chatId, blobId });
    }
    return forked;
}
async function forkedReference(ctx, file) {
    if (file.deletedAt) {
        return removedReference(file);
    }
    if (isPendingBlobReference(file.blobId)) {
        throw new CoreError('CHAT_FORK_FILE_ARRIVING');
    }
    const known = ctx.references.get(file.blobId);
    if (known) {
        return known;
    }
    const copied = await copyBlob(ctx.from, ctx.into, file.blobId);
    if (!copied) {
        throw new CoreError('CHAT_FORK_FILE_NOT_HERE');
    }
    ctx.references.set(file.blobId, copied);
    return copied;
}
async function forkedChat(ctx, input) {
    const { source, cut } = input;
    const now = Date.now();
    const groupId = ctx.same ? source.groupId : undefined;
    const { chats } = await listSidebar(ctx.into);
    const siblings = chats.filter((chat) => (chat.groupId || undefined) === (groupId || undefined));
    const top = siblings.length > 0 ? Math.max(...siblings.map(chatSortKey)) : undefined;
    return {
        ...stripped(source),
        id: ctx.chatId,
        agentId: input.agentId,
        title: input.title || `${source.title} (2)`,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined,
        groupId,
        projectId: ctx.same ? source.projectId : undefined,
        rank: rankOnTop(top, now),
        rankedAt: now,
        readThrough: undefined,
        forkedFrom: {
            meshId: ctx.fromId ?? b4a.toHex(ctx.from.key),
            chatId: source.id,
            runId: cut.runId
        }
    };
}
