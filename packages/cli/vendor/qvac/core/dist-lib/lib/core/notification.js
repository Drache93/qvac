import { diagramRepairLinks, isDiagramRepairPrompt } from '@qvac/harness/lib/diagram-repair.ts';
import { findChunksOfType } from './chunk.js';
import { runDefinition } from './shared-agents.js';
import b4a from 'b4a';
import { ACTIVE_CHATS, AGENTS, CHUNK_COUNTERS, DEVICES, MEMBERS } from './collections.js';
const DEFAULT_LIMIT = 200;
const PREVIEW_LIMIT = 280;
export async function deriveNotifications(mesh, local, { limit: requestedLimit, deviceId } = {}) {
    const limit = requestedLimit || DEFAULT_LIMIT;
    const snap = mesh.view.snapshot();
    try {
        const chats = await snap.find(ACTIVE_CHATS).toArray();
        const candidates = [];
        const own = deviceId ? await snap.get(DEVICES, { id: deviceId }) : null;
        for (const chat of chats) {
            candidates.push(...(await chatCandidates(snap, chat, { local, deviceId, own })));
        }
        candidates.sort((left, right) => right.createdAt - left.createdAt || right.seq - left.seq);
        const maxSeqByChat = new Map();
        for (const candidate of candidates) {
            maxSeqByChat.set(candidate.chatId, Math.max(maxSeqByChat.get(candidate.chatId) ?? 0, candidate.seq));
        }
        const repairRunIdsByChat = new Map();
        const selected = [];
        let truncated = false;
        for (const candidate of candidates) {
            let repairRunIds = repairRunIdsByChat.get(candidate.chatId);
            if (!repairRunIds) {
                const maxSeq = maxSeqByChat.get(candidate.chatId) ?? 0;
                repairRunIds = await diagramRepairRunIds(snap, candidate.chatId, maxSeq);
                repairRunIdsByChat.set(candidate.chatId, repairRunIds);
            }
            if (candidate.runId && repairRunIds.has(candidate.runId)) {
                continue;
            }
            if (selected.length >= limit) {
                truncated = true;
                break;
            }
            selected.push(candidate);
        }
        const terminalSeqByChat = new Map();
        for (const candidate of selected) {
            if (candidate.kind === 'approval-required' || !candidate.runId)
                continue;
            terminalSeqByChat.set(candidate.chatId, Math.max(terminalSeqByChat.get(candidate.chatId) ?? 0, candidate.seq));
        }
        const contentByChat = new Map();
        for (const [chatId, terminalSeq] of terminalSeqByChat) {
            contentByChat.set(chatId, await findChunksOfType(snap, { chatId, type: 'content', lte: terminalSeq }));
        }
        const agentNameById = new Map();
        for (const agentId of new Set(selected.map((candidate) => candidate.agentId))) {
            const row = await snap.get(AGENTS, { id: agentId });
            agentNameById.set(agentId, (await runDefinition(mesh, row))?.name);
        }
        const notifications = selected.map((candidate) => {
            const content = candidate.kind === 'approval-required' ? undefined : contentByChat.get(candidate.chatId);
            const preview = candidate.runId && content ? runPreview(content, candidate.runId, candidate.seq) : undefined;
            const { runId, ...event } = candidate;
            return {
                ...event,
                agentName: agentNameById.get(candidate.agentId),
                preview: candidate.preview ?? preview
            };
        });
        return {
            notifications,
            truncated: truncated || undefined
        };
    }
    finally {
        await snap.close();
    }
}
async function chatCandidates(snap, chat, { local, deviceId, own }) {
    const counter = await snap.get(CHUNK_COUNTERS, { chatId: chat.id });
    const ackedThrough = (await local.getChatNotify(chat.id))?.ackedThrough ?? 0;
    const [statuses, approvals, messages] = await Promise.all([
        (counter?.count ?? 0) <= ackedThrough
            ? []
            : findChunksOfType(snap, { chatId: chat.id, type: 'run-status', gte: ackedThrough }),
        findChunksOfType(snap, { chatId: chat.id, type: 'approval-request' }),
        (counter?.count ?? 0) <= ackedThrough
            ? []
            : findChunksOfType(snap, { chatId: chat.id, type: 'user-message', gte: ackedThrough })
    ]);
    const terminalStatuses = statuses.filter((chunk) => {
        const state = chunk.runStatus?.state;
        return state === 'completed' || state === 'failed';
    });
    const candidates = [];
    for (const chunk of messages) {
        const candidate = await messageCandidate(snap, chunk, { chat, deviceId, own });
        if (candidate) {
            candidates.push(candidate);
        }
    }
    for (const chunk of terminalStatuses) {
        candidates.push({
            chatId: chat.id,
            agentId: chat.agentId,
            chunkId: chunk.id,
            kind: chunk.runStatus?.state === 'completed' ? 'assistant-reply' : 'run-failed',
            seq: chunk.seq,
            createdAt: chunk.createdAt,
            runId: chunk.runId ?? undefined
        });
    }
    for (const chunk of approvals) {
        if (chunk.approvalRequest?.status !== 'pending')
            continue;
        candidates.push({
            chatId: chat.id,
            agentId: chat.agentId,
            chunkId: chunk.id,
            kind: 'approval-required',
            seq: chunk.seq,
            createdAt: chunk.createdAt,
            runId: chunk.runId ?? undefined
        });
    }
    return candidates;
}
async function messageCandidate(snap, chunk, { chat, deviceId, own }) {
    if (deviceId && b4a.equals(deviceId, chunk.originDeviceId))
        return null;
    const text = chunk.userMessage?.text ?? '';
    if (isDiagramRepairPrompt(text)) {
        return null;
    }
    const sender = await snap.get(DEVICES, { id: chunk.originDeviceId });
    const senderMemberId = chunk.requesterMemberId ?? chunk.senderMemberId ?? sender?.memberId;
    if (own?.memberId && senderMemberId && b4a.equals(senderMemberId, own.memberId)) {
        return null;
    }
    const member = senderMemberId ? await snap.get(MEMBERS, { id: senderMemberId }) : null;
    return {
        chatId: chat.id,
        agentId: chat.agentId,
        chunkId: chunk.id,
        kind: 'user-message',
        seq: chunk.seq,
        createdAt: chunk.createdAt,
        senderDeviceId: chunk.originDeviceId,
        senderMemberId,
        senderName: member?.name ?? sender?.name,
        chatTitle: chat.title,
        preview: Array.from(text).slice(0, PREVIEW_LIMIT).join('') || undefined
    };
}
async function diagramRepairRunIds(snap, chatId, toSeq) {
    const [users, requests] = await Promise.all([
        findChunksOfType(snap, { chatId, type: 'user-message', lte: toSeq }),
        findChunksOfType(snap, { chatId, type: 'run-request', lte: toSeq })
    ]);
    const records = [...users, ...requests];
    const repairs = diagramRepairLinks(records, (chunk) => chunk.userMessage?.text ?? null);
    const runIds = new Set();
    for (const chunk of records) {
        if (chunk.runId && isDiagramRepairPrompt(chunk.userMessage?.text ?? '')) {
            runIds.add(chunk.runId);
        }
    }
    for (const repair of repairs) {
        runIds.add(repair.runId);
    }
    return runIds;
}
function runPreview(content, runId, terminalSeq) {
    const text = content
        .filter((chunk) => chunk.seq <= terminalSeq && chunk.runId === runId)
        .map((chunk) => chunk.content?.text ?? '')
        .join('')
        .slice(0, PREVIEW_LIMIT);
    return text || undefined;
}
