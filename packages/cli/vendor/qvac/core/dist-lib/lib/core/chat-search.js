import { diagramRepairAccepted, diagramRepairLinks, isDiagramRepairPrompt } from '@qvac/harness/lib/diagram-repair.ts';
import { hiddenTranscriptText } from './transcript-visibility.js';
import { chunkTypeOrdinal } from '../../schema/indexes.js';
import { enrichAll, lastActivity, liveGroupIds } from './chat.js';
import { ownReads } from './chat-read.js';
import { foldSearchText } from './search-fold.js';
import { ACTIVE_CHATS, CHUNKS_BY_TYPE } from './collections.js';
const DEFAULT_LIMIT = 100;
const PER_CHAT_LIMIT = 20;
const SNIPPET_PAD = 40;
export async function searchChats(store, input) {
    const needle = foldSearchText(input.query.trim());
    if (!needle) {
        return [];
    }
    const limit = input.limit || DEFAULT_LIMIT;
    const snap = store.view.snapshot();
    try {
        const rows = sortChatsNewestFirst(await snap.find(ACTIVE_CHATS).toArray());
        const [activity, liveGroups, reads] = await Promise.all([
            lastActivity(snap),
            liveGroupIds(snap),
            ownReads(snap, rows, store.ourMemberId)
        ]);
        const chats = enrichAll(rows, { activity, liveGroups, reads });
        const titled = [];
        const untitled = [];
        for (const chat of chats) {
            if (foldSearchText(chat.title).includes(needle)) {
                titled.push(chat);
            }
            else {
                untitled.push(chat);
            }
        }
        const hits = [];
        for (const chat of titled) {
            hits.push(titleHit(chat));
            if (hits.length >= limit) {
                return hits;
            }
        }
        for (const chat of [...titled, ...untitled]) {
            if (input.signal?.aborted)
                break;
            hits.push(...(await contentHits(snap, chat, { needle, cap: remainingCap(hits.length, limit) })));
            if (hits.length >= limit) {
                break;
            }
        }
        return hits;
    }
    finally {
        await snap.close();
    }
}
function remainingCap(used, limit) {
    return Math.min(PER_CHAT_LIMIT, limit - used);
}
function titleHit(chat) {
    return { chat, match: 'title', snippet: '', chunkId: '', runId: '' };
}
async function contentHits(snap, chat, { needle, cap }) {
    if (cap <= 0)
        return [];
    const [users, written, attachments, requests, statuses, resets] = await Promise.all([
        chunksOfType(snap, chat.id, 'user-message'),
        chunksOfType(snap, chat.id, 'content'),
        chunksOfType(snap, chat.id, 'attachment'),
        chunksOfType(snap, chat.id, 'run-request'),
        chunksOfType(snap, chat.id, 'run-status'),
        chunksOfType(snap, chat.id, 'round-reset')
    ]);
    const replaced = hiddenTranscriptText([...written, ...statuses, ...resets]);
    const content = written.filter((chunk) => !replaced.has(chunk.id));
    const repairs = diagramRepairLinks([...users, ...requests], (chunk) => {
        return chunk.userMessage?.text ?? null;
    });
    const hiddenPromptIds = new Set(users.filter((user) => isDiagramRepairPrompt(user.userMessage?.text ?? '')).map((u) => u.id));
    const repairText = (target) => content
        .filter((chunk) => chunk.runId === target)
        .map((chunk) => chunk.content?.text ?? '')
        .join('');
    const completedRunIds = new Set(statuses
        .filter((status) => status.runStatus?.state === 'completed' && status.runId)
        .map((status) => status.runId));
    const hiddenRunIds = new Set();
    const redactedRunIds = new Set();
    for (const repair of repairs) {
        const parentRunId = requests.find((request) => request.id === repair.parentId)?.runId;
        if (completedRunIds.has(repair.runId) && diagramRepairAccepted(repairText(repair.runId))) {
            if (parentRunId) {
                hiddenRunIds.add(parentRunId);
            }
        }
        else {
            hiddenRunIds.add(repair.runId);
            if (parentRunId) {
                redactedRunIds.add(parentRunId);
            }
        }
    }
    const matches = [
        ...matchUserMessages(users, needle, { cap, hiddenIds: hiddenPromptIds }),
        ...matchJoinedContent(content, needle, { cap, hidden: hiddenRunIds, redacted: redactedRunIds }),
        ...matchAttachments(attachments, needle, cap)
    ];
    return matches
        .sort((left, right) => left.seq - right.seq)
        .slice(0, cap)
        .map((found) => ({
        chat,
        match: 'content',
        snippet: found.snippet,
        chunkId: found.chunkId,
        runId: found.runId
    }));
}
async function chunksOfType(snap, chatId, type) {
    const ordinal = chunkTypeOrdinal(type);
    return snap
        .find(CHUNKS_BY_TYPE, {
        gte: { chatId, type: ordinal },
        lte: { chatId, type: ordinal }
    })
        .toArray();
}
function matchUserMessages(chunks, needle, { cap, hiddenIds }) {
    const matches = [];
    for (const chunk of chunks) {
        if (matches.length >= cap)
            break;
        const text = chunk.userMessage?.text;
        if (!text || hiddenIds.has(chunk.id)) {
            continue;
        }
        const found = locate(text, needle);
        if (!found) {
            continue;
        }
        matches.push({ seq: chunk.seq, snippet: found, chunkId: chunk.id, runId: chunk.runId ?? '' });
    }
    return matches;
}
function matchJoinedContent(chunks, needle, { cap, ...runs }) {
    const byRun = new Map();
    const order = [];
    for (const chunk of chunks) {
        const runId = chunk.runId;
        if (!runId || runs.hidden.has(runId)) {
            continue;
        }
        const group = byRun.get(runId);
        if (group) {
            group.push(chunk);
            continue;
        }
        byRun.set(runId, [chunk]);
        order.push(runId);
    }
    const matches = [];
    for (const runId of order) {
        if (matches.length >= cap)
            break;
        const group = byRun.get(runId);
        const first = group?.[0];
        if (!group || !first) {
            continue;
        }
        const content = group.map((chunk) => chunk.content?.text ?? '').join('');
        const text = runs.redacted.has(runId) ? withoutMermaidDiagrams(content) : content;
        const found = locate(text, needle);
        if (!found) {
            continue;
        }
        matches.push({ seq: first.seq, snippet: found, chunkId: first.id, runId });
    }
    return matches;
}
function withoutMermaidDiagrams(content) {
    return content.replace(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*mermaid[ \t]*\r?\n[\s\S]*?(?:^[ \t]{0,3}\1[ \t]*$|(?![\s\S]))/gm, '');
}
function matchAttachments(chunks, needle, cap) {
    const matches = [];
    for (const chunk of chunks) {
        if (matches.length >= cap)
            break;
        const attachment = chunk.attachment;
        if (!attachment || (attachment.deletedAt ?? 0) > 0 || chunk.sourceId) {
            continue;
        }
        const found = locate(attachment.fileName, needle);
        if (!found) {
            continue;
        }
        matches.push({ seq: chunk.seq, snippet: found, chunkId: chunk.id, runId: chunk.runId ?? '' });
    }
    return matches;
}
function locate(text, needle) {
    if (!text)
        return null;
    const index = foldSearchText(text).indexOf(needle);
    if (index < 0) {
        return null;
    }
    return snippetAround(text, index, needle.length);
}
function snippetAround(text, index, needleLength) {
    const start = Math.max(0, index - SNIPPET_PAD);
    const end = Math.min(text.length, index + needleLength + SNIPPET_PAD);
    const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    return `${prefix}${body}${suffix}`;
}
function sortChatsNewestFirst(chats) {
    return [...chats].sort((left, right) => chatRecency(right) - chatRecency(left));
}
function chatRecency(chat) {
    return chat.updatedAt || chat.createdAt;
}
