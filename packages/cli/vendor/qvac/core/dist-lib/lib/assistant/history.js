import { attachmentTurn, skillLoadedTurn } from '@qvac/harness/lib/capabilities/tool-turns.ts';
import { HISTORY_CHUNK_TYPES } from '../core/chunk.js';
import { isAudioAttachment } from '../core/audio-attachment.js';
import { isDocumentAttachment, isPdfAttachment } from '../core/document-attachment.js';
import { groupAttachmentsByMessage } from '../core/files/index.js';
import { IMAGE_MIMES } from '../core/image/normalize.js';
import { isVideoAttachment } from '../core/video/attachment.js';
import { compactionTurn, foldCompactedChunks } from '../compaction.js';
import { attemptStarts, hiddenTranscriptText } from '../core/transcript-visibility.js';
import { acceptedRepairCount, historyBranches, isPromptChunk } from '../core/prompt-history.js';
import { isChatMessage } from '../run-replay.js';
import { isRecord } from '../guards.js';
import { STEERED } from '../run-input.js';
export function senderOf(chunk) {
    return (chunk.requesterMemberId && (chunk.senderNameAtSend ?? chunk.senderName)) || undefined;
}
export const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled', 'recovery-required']);
export const HISTORY_TYPES = HISTORY_CHUNK_TYPES;
export const SKILL_TOOL = 'skill';
export async function listHistoryChunks(engine, chatId) {
    const [history, toolResults, runStatuses] = await Promise.all([
        engine.listChunks({ chatId, types: HISTORY_TYPES }),
        engine.listChunks({ chatId, type: 'tool-result' }),
        engine.listChunks({ chatId, type: 'run-status' })
    ]);
    return [
        ...(history.chunks ?? []),
        ...(toolResults.chunks ?? []),
        ...(runStatuses.chunks ?? [])
    ].sort((a, b) => a.seq - b.seq);
}
export function latestAttemptStarts(chunks) {
    return attemptStarts(chunks);
}
export function beforeLatestAttempt(chunk, starts) {
    if (!chunk.runId)
        return false;
    const start = starts.get(chunk.runId);
    return start !== undefined && chunk.seq < start;
}
function repeatedCall(chunk, answered) {
    if (!chunk.runId || typeof chunk.round !== 'number' || !chunk.callId) {
        return false;
    }
    const key = JSON.stringify([chunk.runId, chunk.round, chunk.callId]);
    if (answered.has(key)) {
        return true;
    }
    answered.add(key);
    return false;
}
function derivedAttachments(chunks) {
    const derived = new Map();
    for (const chunk of chunks) {
        const { sourceId, attachment } = chunk;
        if (sourceId && attachment && !attachment.deletedAt && !derived.has(sourceId)) {
            derived.set(sourceId, attachment);
        }
    }
    return derived;
}
export function historyFromChunks(chunks, stale = {}, { sentRuns = new Map(), askedRuns = new Map(), readRuns = new Map() } = {}) {
    const attemptStarts = latestAttemptStarts(chunks);
    const hiddenText = hiddenTranscriptText(chunks);
    const staleRunIds = stale.runIds ?? new Set();
    const staleQuestionChunkIds = stale.questionChunkIds ?? new Set();
    const folded = foldCompactedChunks(chunks);
    const source = folded.chunks;
    const attachments = [];
    const userMessages = [];
    for (const chunk of source) {
        if (chunk.type === 'attachment' && !chunk.sourceId) {
            attachments.push(chunk);
        }
        else if (chunk.userMessage) {
            userMessages.push(chunk);
        }
    }
    const byMessage = groupAttachmentsByMessage(attachments, userMessages);
    const digests = derivedAttachments(chunks);
    const steered = steeredQuestions(source, sentRuns);
    const history = [];
    const replayedSkills = new Set();
    const answeredCalls = new Set();
    if (folded.summary) {
        history.push({ role: 'user', content: compactionTurn(folded.summary) });
    }
    const byRun = new Map();
    const kept = new Set();
    let asking = null;
    const anchor = (runId) => {
        let turn = byRun.get(runId);
        if (!turn) {
            turn = { role: 'assistant', content: '' };
            byRun.set(runId, turn);
            const live = runId && !staleRunIds.has(runId) ? runId : undefined;
            const asked = live ? askedRuns.get(live) : undefined;
            if (asking && asked !== undefined) {
                asking.sentContent = asked;
            }
            const read = live ? readRuns.get(live) : undefined;
            if (asking && read !== undefined) {
                asking.readContent = read;
            }
            const sent = live ? sentRuns.get(live) : undefined;
            if (sent) {
                const replayed = sent.map((message) => ({ ...message }));
                history.push(...replayed);
                for (const message of [...replayed, turn]) {
                    kept.add(message);
                }
            }
            history.push(turn);
        }
        return turn;
    };
    for (const chunk of source) {
        if (chunk.userMessage) {
            if (staleQuestionChunkIds.has(chunk.id) || steered.has(chunk.id)) {
                continue;
            }
            const sender = senderOf(chunk);
            const turn = {
                role: 'user',
                content: chunk.userMessage.text,
                sentAt: chunk.createdAt
            };
            if (sender) {
                turn.sender = sender;
            }
            asking = turn;
            const refs = (byMessage.get(chunk.id) ?? [])
                .flatMap((attachmentChunk) => attachmentChunk.attachment ?? [])
                .filter((ref) => !ref.deletedAt);
            const images = refs.filter((ref) => IMAGE_MIMES.has(ref.mimeType.toLowerCase()));
            const videos = refs.filter((ref) => isVideoAttachment(ref.fileName, ref.mimeType));
            const audio = refs.filter((ref) => isAudioAttachment(ref.fileName, ref.mimeType) && !videos.includes(ref));
            const documents = refs.filter((ref) => isDocumentAttachment(ref));
            const pdfs = documents.filter(isPdfAttachment);
            if (images.length) {
                turn.images = images;
            }
            if (audio.length) {
                turn.audioAttachments = audio;
            }
            if (videos.length) {
                turn.videos = videos.map((ref) => ({ ...ref, digest: digests.get(ref.id) }));
            }
            if (documents.length) {
                turn.documents = documents;
            }
            if (pdfs.length) {
                turn.pdfs = pdfs;
            }
            history.push(turn);
            continue;
        }
        if (chunk.attachment) {
            continue;
        }
        if (chunk.type === 'run-request' && chunk.runId) {
            anchor(chunk.runId);
            continue;
        }
        if (chunk.toolResult && chunk.runId && sentRuns.has(chunk.runId)) {
            continue;
        }
        if (chunk.toolResult?.name === SKILL_TOOL) {
            if (chunk.runId && staleRunIds.has(chunk.runId)) {
                continue;
            }
            if (beforeLatestAttempt(chunk, attemptStarts)) {
                continue;
            }
            const { result } = chunk.toolResult;
            const loaded = isRecord(result) ? result.name : undefined;
            if (typeof loaded === 'string' && !replayedSkills.has(loaded)) {
                replayedSkills.add(loaded);
                const at = history.indexOf(anchor(chunk.runId)) + 1;
                history.splice(at, 0, { role: 'tool', content: skillLoadedTurn(loaded) });
            }
            continue;
        }
        if (chunk.toolResult) {
            if (chunk.runId && staleRunIds.has(chunk.runId)) {
                continue;
            }
            if (beforeLatestAttempt(chunk, attemptStarts) || repeatedCall(chunk, answeredCalls)) {
                continue;
            }
            const produced = attachmentTurn(chunk.toolResult.name, chunk.toolResult.result);
            if (produced) {
                history.push({ role: 'tool', content: produced });
            }
            continue;
        }
        if (!chunk.content) {
            continue;
        }
        if (chunk.runId && staleRunIds.has(chunk.runId)) {
            continue;
        }
        if (hiddenText.has(chunk.id)) {
            continue;
        }
        anchor(chunk.runId).content += chunk.content.text;
    }
    return history.filter((turn) => turn.role === 'user' || turn.content.length > 0 || kept.has(turn));
}
function steeredQuestions(chunks, sentRuns) {
    const into = new Map();
    for (const chunk of chunks) {
        const metrics = chunk.runStatus?.reason === STEERED ? chunk.runStatus?.metrics : undefined;
        const target = isRecord(metrics) ? metrics.steeredInto : undefined;
        if (chunk.runId && typeof target === 'string') {
            into.set(chunk.runId, target);
        }
    }
    const questions = new Set();
    let lastUser = null;
    for (const chunk of chunks) {
        if (chunk.userMessage) {
            lastUser = chunk.id;
            continue;
        }
        const target = chunk.type === 'run-request' && chunk.runId ? into.get(chunk.runId) : undefined;
        if (lastUser && target && sentRuns.has(target)) {
            questions.add(lastUser);
        }
    }
    return questions;
}
export function runPromptView(all, approvals, run) {
    const branches = historyBranches(all, run.runId);
    const repair = branches.repairByRunId.get(run.runId);
    const repairParent = repair ? all.find((chunk) => chunk.id === repair.parentId) : undefined;
    const history = runView(all, run).filter((chunk) => !!chunk.compaction ||
        ((!repairParent || chunk.seq <= repairParent.seq || chunk.runId === repairParent.runId) &&
            isPromptChunk(chunk, branches)));
    return {
        history,
        stale: staleToolRunIds(history, approvals, run.runId),
        repair,
        acceptedRepairs: acceptedRepairCount(branches, run.runId)
    };
}
export function replayFromChunks(rounds) {
    const sentRuns = new Map();
    const readRuns = new Map();
    for (const chunk of rounds) {
        if (!chunk.runId)
            continue;
        const sent = sentTurn(chunk);
        if (sent !== undefined) {
            readRuns.set(chunk.runId, sent);
        }
        const turns = chunk.modelRequest?.state === 'done' ? chunk.modelRequest.toolTurns : undefined;
        if (Array.isArray(turns)) {
            sentRuns.set(chunk.runId, turns.filter(isChatMessage).map(({ role, content }) => ({ role, content })));
        }
    }
    return { sentRuns, readRuns };
}
export function sentTurn(chunk) {
    const turn = chunk.context?.turn;
    return isRecord(turn) && typeof turn.sent === 'string' ? turn.sent : undefined;
}
export function runView(chunks, { request, runId }) {
    const fixed = !!request.requesterMemberId;
    const seqs = new Map();
    const settled = new Set();
    for (const chunk of chunks) {
        seqs.set(chunk.id, chunk.seq);
        const terminal = TERMINAL_STATES.has(chunk.runStatus?.state ?? '');
        if (chunk.runId && terminal && chunk.seq < request.seq) {
            settled.add(chunk.runId);
        }
    }
    return chunks.filter((chunk) => {
        if (chunk.compaction) {
            return !fixed || (seqs.get(chunk.compaction.throughId) ?? Infinity) < request.seq;
        }
        if (!chunk.runId) {
            return chunk.seq < request.seq;
        }
        return (chunk.runId !== runId && (!fixed || (settled.has(chunk.runId) && chunk.seq < request.seq)));
    });
}
export function foldableView(chunks, run) {
    const view = runView(chunks, run);
    const kept = new Set(view);
    const started = new Set(chunks.map((chunk) => (chunk.type === 'run-request' ? null : chunk.runId)));
    const caps = (chunk) => !kept.has(chunk) &&
        !chunk.compaction &&
        chunk.runId !== run.runId &&
        !(chunk.type === 'run-request' && !started.has(chunk.runId));
    const limit = chunks.reduce((low, chunk) => (caps(chunk) ? Math.min(low, chunk.seq) : low), Infinity);
    return view.filter((chunk) => chunk.compaction || chunk.seq < limit);
}
export function viewOutgrewCache(chunks, run, cachedRuns) {
    const cached = chunks.findLast((chunk) => chunk.type === 'run-request' &&
        chunk.seq < run.request.seq &&
        !!chunk.runId &&
        cachedRuns.has(chunk.runId));
    if (!cached?.runId) {
        return false;
    }
    const asked = (view) => view.filter((chunk) => chunk.type === 'run-request');
    const before = new Set(asked(runView(chunks, { request: cached, runId: cached.runId })).map((chunk) => chunk.id));
    const now = asked(runView(chunks, run));
    const inserted = now.some((chunk) => chunk.seq < cached.seq && !before.has(chunk.id));
    return inserted || !now.some((chunk) => chunk.id === cached.id);
}
export function normalizeQuestion(text) {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
export const GENERIC_ACKNOWLEDGEMENTS = new Set([
    'yes',
    'y',
    'yeah',
    'yep',
    'yup',
    'ok',
    'okay',
    'k',
    'sure',
    'fine',
    'no',
    'n',
    'nope',
    'nah',
    'again',
    'continue',
    'go on',
    'go ahead',
    'keep going',
    'proceed',
    'do it',
    'more',
    'please',
    'thanks',
    'thank you',
    'retry',
    'redo'
]);
export function isGenericAcknowledgement(question) {
    return GENERIC_ACKNOWLEDGEMENTS.has(question.replace(/[?.!]+$/, '').trim());
}
export function staleToolRunIds(historyChunks, approvalChunks, currentRunId) {
    const empty = { runIds: new Set(), questionChunkIds: new Set() };
    const toolRuns = new Set();
    for (const chunk of approvalChunks) {
        if (chunk.runId) {
            toolRuns.add(chunk.runId);
        }
    }
    if (!toolRuns.size) {
        return empty;
    }
    const turnText = new Map();
    const turnRuns = new Map();
    const runChunk = new Map();
    let lastUser = null;
    for (const chunk of historyChunks) {
        if (chunk.userMessage) {
            lastUser = { text: chunk.userMessage.text, chunkId: chunk.id };
            continue;
        }
        if (chunk.type === 'run-request' && chunk.runId && lastUser !== null) {
            const chunkId = lastUser.chunkId;
            if (!turnText.has(chunkId)) {
                turnText.set(chunkId, lastUser.text);
            }
            turnRuns.set(chunkId, [...(turnRuns.get(chunkId) ?? []), chunk.runId]);
            runChunk.set(chunk.runId, chunkId);
        }
    }
    const currentChunkId = runChunk.get(currentRunId) ?? lastUser?.chunkId;
    if (currentChunkId === undefined) {
        return empty;
    }
    const currentText = turnText.get(currentChunkId) ?? lastUser?.text;
    if (currentText === undefined) {
        return empty;
    }
    const target = normalizeQuestion(currentText);
    if (isGenericAcknowledgement(target)) {
        return empty;
    }
    const turns = [...turnText];
    const currentIndex = turns.findIndex(([chunkId]) => chunkId === currentChunkId);
    const start = currentIndex === -1 ? turns.length - 1 : currentIndex - 1;
    const runIds = new Set();
    const questionChunkIds = new Set();
    let blockHadApproval = false;
    for (let i = start; i >= 0; i--) {
        const [chunkId, text] = turns[i];
        if (normalizeQuestion(text) !== target) {
            break;
        }
        questionChunkIds.add(chunkId);
        for (const rid of turnRuns.get(chunkId) ?? []) {
            runIds.add(rid);
            if (toolRuns.has(rid)) {
                blockHadApproval = true;
            }
        }
    }
    if (!blockHadApproval) {
        return empty;
    }
    return { runIds, questionChunkIds };
}
