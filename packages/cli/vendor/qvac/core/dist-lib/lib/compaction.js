import { CONTEXT_OVERFLOW_MESSAGE } from '@qvac/harness';
import { COMPACTION_MIN_CTX_SIZE } from './model-context.js';
export const COMPACTION_KEEP_TURNS = 1;
export const COMPACTION_TURN_PREFIX = '[Summary of the earlier conversation in this chat, written by another model. Treat it as established context, not as a new request.]';
export function compactionTurn(summary) {
    return `${COMPACTION_TURN_PREFIX}\n\n${summary}`;
}
export function foldReducesPrompt(folded, summary) {
    const replaced = folded.reduce((total, turn) => total + turn.content.length, 0);
    return compactionTurn(summary).length < replaced;
}
export function canCompact(ctxSize) {
    return (ctxSize ?? 0) >= COMPACTION_MIN_CTX_SIZE;
}
export function buildCompactionPrompt(turns, hasPriorSummary) {
    const transcript = turns
        .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
        .join('\n\n');
    return [
        'Summarize the conversation below so another model can continue it without seeing it.',
        hasPriorSummary
            ? 'The conversation opens with an earlier summary. Carry everything from it that is still true into your new summary — it is discarded after this, so whatever you leave out is lost — and correct it where the later turns disagree.'
            : null,
        'Output exactly these four sections, in this order, keeping every heading even when it has nothing under it:',
        '## Objective\n## Facts and decisions\n## State\n## Next steps',
        'Rules: at most three bullets per section, at most fifteen words per bullet. Preserve names, numbers, file paths and identifiers exactly. Write "(none)" under a heading with nothing to say. Do not continue the conversation, do not answer anything asked in it, and do not mention summarizing.',
        '<conversation>',
        transcript,
        '</conversation>'
    ]
        .filter((part) => part !== null)
        .join('\n\n');
}
export function parseCompactionSummary(text) {
    const summary = text.trim();
    return summary.length > 0 ? summary : null;
}
export function compactionBoundary(chunks, keepTurns = COMPACTION_KEEP_TURNS) {
    const userTurns = [];
    for (let index = 0; index < chunks.length; index++) {
        if (chunks[index].userMessage) {
            userTurns.push(index);
        }
    }
    if (userTurns.length <= keepTurns) {
        return null;
    }
    const firstKept = userTurns[userTurns.length - keepTurns];
    let from = firstKept;
    for (let index = firstKept - 1; index > userTurns[userTurns.length - keepTurns - 1]; index--) {
        if (chunks[index].attachment && !chunks[index].runId) {
            from = index;
        }
    }
    const boundary = chunks[from - 1];
    if (!boundary) {
        return null;
    }
    return { throughId: boundary.id, foldedTurns: userTurns.length - keepTurns };
}
function newestCompaction(chunks) {
    let newest = null;
    for (const chunk of chunks) {
        if (chunk.compaction && (!newest || chunk.seq > newest.seq)) {
            newest = chunk;
        }
    }
    return newest;
}
export function lastCompactedThroughId(chunks) {
    return newestCompaction(chunks)?.compaction?.throughId ?? null;
}
export function foldCompactedChunks(chunks) {
    const compaction = newestCompaction(chunks)?.compaction;
    if (!compaction) {
        return { chunks, summary: null };
    }
    const through = chunks.find((chunk) => chunk.id === compaction.throughId);
    if (!through) {
        return { chunks, summary: null };
    }
    return {
        chunks: chunks.filter((chunk) => chunk.seq > through.seq && !chunk.compaction),
        summary: compaction.summary
    };
}
export const COMPACTION_TRIGGER_TIERS = [
    [12_288, 0.75],
    [16_384, 0.82],
    [32_768, 0.85],
    [65_536, 0.9]
];
export const COMPACTION_TRIGGER_RATIO = 0.95;
export function compactionTriggerRatio(ctxSize) {
    return (COMPACTION_TRIGGER_TIERS.find(([below]) => ctxSize < below)?.[1] ?? COMPACTION_TRIGGER_RATIO);
}
export function nearContextLimit(cacheTokens, ctxSize) {
    if (!cacheTokens || !ctxSize)
        return false;
    return cacheTokens >= ctxSize * compactionTriggerRatio(ctxSize);
}
export function isContextOverflowFailure(message) {
    return message === CONTEXT_OVERFLOW_MESSAGE;
}
