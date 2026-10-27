import { isRecord } from '../guards.js';
export const DEGENERATE_ANSWER_FALLBACK = "I couldn't complete that step and don't have a useful result to share.";
export const ROUND_CAP_ANSWER = "I ran out of steps before I could finish that. Ask me to continue and I'll pick up where I left off.";
export const SEARCH_CAPPED_ANSWER = "I searched the web but couldn't find the answer in the results I got.";
export const DELIVERED_ANSWER = 'Your file is attached to the chat.';
export const WRITE_RESULT_LEAD = "Here's what came back:";
export const TIME_CAPPED_ANSWER = "I hit this run's time budget before I could finish that. Ask me to continue and I'll pick up where I left off.";
const MAX_FAILURE_CHARS = 300;
const MAX_SUCCESS_CHARS = 800;
const MAX_WRITES_LISTED = 4;
const MAX_CAPPED_SOURCES = 3;
const TOOL_RESULT_HEADER_RE = /^\[Tool: [^(\]]+ \([^)]+\)\]\n/;
const WEB_SEARCH_TURN_RE = /^\[Tool: web_search /;
const RESULT_ENTRY_RE = /\[\d+\] ([^\n]+)\nSource: (\S+)/g;
const WRITE_ID_RE = /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi;
export function createRunOutcomeTracker(state) {
    const confirmedWrites = [...(state?.confirmedWrites ?? [])];
    let roundFailure = state?.roundFailure ?? null;
    let latestFailure = state?.latestFailure ?? null;
    let hasRoundResult = state?.hasRoundResult ?? false;
    return {
        confirmedWrites,
        beginRound() {
            roundFailure = null;
            hasRoundResult = false;
        },
        record(result, outcome) {
            hasRoundResult = true;
            const failure = failureFromToolExecution(result, outcome);
            if (failure) {
                roundFailure = failure;
            }
        },
        finishRound() {
            if (!hasRoundResult)
                return;
            latestFailure = roundFailure;
        },
        confirmWrite(result) {
            const write = writeResult(result);
            if (write) {
                confirmedWrites.push(write);
            }
        },
        snapshot() {
            return { confirmedWrites: [...confirmedWrites], roundFailure, latestFailure, hasRoundResult };
        },
        facts() {
            return { latestFailure, confirmedWrites };
        }
    };
}
export function normalizeToolExecutionOutcome(result, outcome) {
    if (outcome.kind !== 'success')
        return outcome;
    const failure = resultFailure(result);
    return failure ? { kind: 'error', message: failure } : outcome;
}
export function failureFromToolExecution(result, outcome) {
    if (outcome.kind === 'denied' || outcome.kind === 'blocked' || outcome.kind === 'guidance') {
        return null;
    }
    if (outcome.kind === 'error') {
        return bound(outcome.message ?? resultFailure(result) ?? 'The request failed.', MAX_FAILURE_CHARS);
    }
    return resultFailure(result);
}
export function degenerateAnswer(outcome, history, facts) {
    const rest = facts.latestFailure ?? cappedAnswer(outcome, history);
    const lines = [
        writeReport(facts.confirmedWrites),
        facts.delivered ? DELIVERED_ANSWER : null,
        rest
    ].filter((line) => line !== null);
    return lines.length ? lines.join('\n\n') : DEGENERATE_ANSWER_FALLBACK;
}
function cappedAnswer(outcome, history) {
    if (outcome === 'search-capped') {
        return searchCappedAnswer(history);
    }
    if (outcome === 'time-capped')
        return TIME_CAPPED_ANSWER;
    return outcome === 'exhausted' ? ROUND_CAP_ANSWER : null;
}
function searchCappedAnswer(history) {
    const seen = new Set();
    const lines = [];
    for (const turn of history) {
        if (lines.length === MAX_CAPPED_SOURCES)
            break;
        if (turn.role !== 'tool' || !WEB_SEARCH_TURN_RE.test(turn.content))
            continue;
        const payload = parsed(turn.content.replace(TOOL_RESULT_HEADER_RE, ''));
        const content = typeof payload?.content === 'string' ? payload.content : '';
        for (const [, title, url] of content.matchAll(RESULT_ENTRY_RE)) {
            if (title === undefined || url === undefined)
                continue;
            if (seen.has(url))
                continue;
            seen.add(url);
            lines.push(`- ${title.trim()}: ${url}`);
            if (lines.length === MAX_CAPPED_SOURCES) {
                break;
            }
        }
    }
    if (!lines.length) {
        return SEARCH_CAPPED_ANSWER;
    }
    return `${SEARCH_CAPPED_ANSWER} These pages looked most relevant:\n${lines.join('\n')}`;
}
export function lastFailedToolAnswer(history, nudge) {
    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn?.role === 'user' &&
            (turn.content === nudge || turn.content.startsWith(`${nudge}\nPlan:\n`))) {
            continue;
        }
        if (turn?.role !== 'tool') {
            return null;
        }
        const failure = failureText(turn.content.replace(TOOL_RESULT_HEADER_RE, ''));
        if (failure) {
            return failure;
        }
    }
    return null;
}
export function writeResult(output) {
    const result = asRecord(output);
    if (!result || typeof result.status !== 'number') {
        return null;
    }
    if (result.status >= 400 || nonEmpty(result.error)) {
        return null;
    }
    return nonEmpty(result.body);
}
export function unnamedWrites(answer, landed) {
    const said = withoutDashes(answer);
    return landed.filter((write) => {
        const ids = writeIds(write);
        return ids.length > 0 && !ids.some((id) => said.includes(id));
    });
}
function writeIds(write) {
    return [...write.matchAll(WRITE_ID_RE)].map(([id]) => withoutDashes(id));
}
function withoutDashes(text) {
    return text.toLowerCase().replace(/-/g, '');
}
export function writeReport(landed) {
    if (!landed.length)
        return null;
    const listed = landed.slice(0, MAX_WRITES_LISTED);
    const share = Math.floor(MAX_SUCCESS_CHARS / listed.length);
    const lines = listed.map((write) => bound(write, share));
    const dropped = landed.length - listed.length;
    if (dropped) {
        lines.push(`(+${dropped} more)`);
    }
    return `${WRITE_RESULT_LEAD}\n${lines.join('\n')}`;
}
function failureText(payload) {
    const result = parsed(payload);
    return resultFailure(result);
}
function resultFailure(value) {
    const result = typeof value === 'string' ? parsed(value) : asRecord(value);
    if (!result) {
        return null;
    }
    if (result.denied === true || result.guidance === true) {
        return null;
    }
    const status = typeof result.status === 'number' ? result.status : null;
    const httpSuffix = status !== null && status >= 400 ? ` (HTTP ${status.toString()})` : '';
    const error = nonEmpty(result.error);
    if (error) {
        return `${bound(error, MAX_FAILURE_CHARS)}${httpSuffix}`;
    }
    if (status !== null && status >= 400) {
        return httpFailure(status, result.body);
    }
    if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
        const output = nonEmpty(result.stderr) ?? nonEmpty(result.stdout);
        return output ? bound(output, MAX_FAILURE_CHARS) : null;
    }
    return null;
}
function httpFailure(status, body) {
    const message = apiMessage(body);
    return message
        ? `${bound(message, MAX_FAILURE_CHARS)} (HTTP ${status})`
        : `The request failed with HTTP ${status}.`;
}
function apiMessage(body) {
    const value = typeof body === 'string' ? parsed(body) : asRecord(body);
    if (!value) {
        return null;
    }
    const error = value.error;
    const fromError = typeof error === 'string' ? nonEmpty(error) : nonEmpty(asRecord(error)?.['message']);
    return fromError ?? nonEmpty(value.message);
}
function parsed(payload) {
    try {
        return asRecord(JSON.parse(payload));
    }
    catch {
        return null;
    }
}
function asRecord(value) {
    return isRecord(value) && !Array.isArray(value) ? value : null;
}
function nonEmpty(value) {
    if (typeof value !== 'string')
        return null;
    const text = value.trim();
    return text || null;
}
function bound(text, max) {
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
