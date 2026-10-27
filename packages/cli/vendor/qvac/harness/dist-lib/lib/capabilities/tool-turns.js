import { isRecord } from '../guards.js';
import { Agent } from '../agent/index.js';
import { headTail } from '../helpers/head-tail.js';
import { MAX_GOAL_CHECKS } from '../helpers/goal-check.js';
import { compactContent } from '../context-window.js';
import { TOOL_SEARCH_TOOL_NAME } from './sdk-tool.js';
import { isFailureResultReference, readFailureResult } from '../helpers/failure-result.js';
export const DIRECT_CALL_ID = 'call-direct';
export const PRELOAD_ID_PREFIX = 'preload-';
export const MAX_TOOL_ROUNDS = 10;
export const GOAL_ROUNDS = 40;
export const TOOL_CONTINUATION_NUDGE = "[Tool results above. Continue the user's request: call the next tool, or answer.]";
export const FILE_DELIVERED_NUDGE = '[Tool results above. The file is attached to the chat and shown to the user. Answer now, unless the request still needs a file that is not made yet.]';
export const TOOL_DENIED_MESSAGE = 'The user declined this call. Do not retry it or call it with different arguments to get ' +
    'around the refusal. Tell the user plainly what you could not do, and never present a ' +
    'result you did not obtain.';
export const TOOL_CUT_OFF_MESSAGE = 'This tool call was not executed: the response hit the output token limit, so its ' +
    'arguments may be truncated. Re-issue the tool call with complete arguments, and keep ' +
    'them short enough to finish.';
export const TOOL_ROUND_CUT_MESSAGE = 'This tool call was not executed: the round was stopped before it finished, so its ' +
    'arguments may be truncated. Re-issue the call with complete arguments if it is still needed.';
export const TOOL_CONTEXT_BOUNDARY_MESSAGE = 'This tool call was not executed: the context window filled before its arguments were ' +
    'complete, so they may be truncated. Re-issue the call with complete arguments, and keep ' +
    'them short.';
export const TOOL_REPEATED_MESSAGE = 'You sent the same tool call more than once in one response. It ran once, and its result ' +
    'is below. Send each call once.';
export const TOOL_FAILING_MESSAGE = 'This call has failed {count} times in a row. Before changing anything again, step back: ' +
    're-read the failing output and the requirements, work out what the failures have in common, ' +
    'and change your approach instead of patching the last error.';
export const FAILURE_STREAK = 3;
export const TOOL_UNCHANGED_MESSAGE = 'This call returned the same result the last {count} times it ran. Running it again will ' +
    'not change it: use the result you have, try something else, or answer.';
export const GOAL_CONTINUATION_NUDGE = '[The goal is not met yet. Keep working on it: call the next tool. Track the work with ' +
    'update_plan. With no plan yet, write one first: one step per requirement the goal states, ' +
    'the last step a check of the whole result with a tool. Mark a step done only once a tool ' +
    'result shows it is done; the goal is met when every step is done.]';
export function checkMaxToolRounds(rounds) {
    if (!Number.isSafeInteger(rounds) || rounds < 1) {
        throw new Error(`maxToolRounds must be an integer of 1 or more, got ${rounds}`);
    }
    return rounds;
}
export function checkGoal(goal, responseFormat) {
    if (responseFormat) {
        throw new Error('A goal cannot run with a responseFormat: the run would have no plan to finish');
    }
    if (typeof goal.objective !== 'string' || !goal.objective.trim()) {
        throw new Error('A goal needs an objective');
    }
    for (const key of ['rounds', 'ms', 'tokens']) {
        const value = goal[key];
        if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
            throw new Error(`goal.${key} must be an integer of 1 or more, got ${value}`);
        }
    }
    const { checks } = goal;
    if (checks !== undefined &&
        (!Array.isArray(checks) ||
            checks.length > MAX_GOAL_CHECKS ||
            !checks.every((check) => typeof check === 'string' && check.trim()))) {
        throw new Error(`goal.checks must be up to ${MAX_GOAL_CHECKS} commands, none of them blank`);
    }
    return goal;
}
export const TOOL_RESULT_MAX_CHARS = 65_536;
const MIN_LEAF_CHARS = 256;
const HOOK_CONTEXT_KEY = 'hookContext';
export function withHookContext(output, context) {
    if (context === undefined) {
        return output;
    }
    const base = isRecord(output) && !Array.isArray(output) ? output : { result: output };
    const prior = base[HOOK_CONTEXT_KEY];
    return {
        ...base,
        [HOOK_CONTEXT_KEY]: typeof prior === 'string' ? `${prior}\n${context}` : context
    };
}
export function deliversFile(output) {
    return isRecord(output) && Array.isArray(output.attachments) && output.attachments.length > 0;
}
export function toolResultTurn(name, id, output) {
    let context = '';
    let shown = output;
    if (isRecord(output) && typeof output[HOOK_CONTEXT_KEY] === 'string') {
        const { [HOOK_CONTEXT_KEY]: added, ...rest } = output;
        context = `\n${String(added)}`;
        shown = rest;
    }
    const payload = historyPayload(shown);
    if (name === TOOL_SEARCH_TOOL_NAME) {
        return JSON.stringify(payload);
    }
    const text = name === Agent.SKILL_TOOL_NAME ? JSON.stringify(payload) : fitted(payload);
    return `[Tool: ${name} (${id})]\n${text}${context}`;
}
function fitted(payload) {
    const whole = JSON.stringify(payload);
    if (whole === undefined || whole.length <= TOOL_RESULT_MAX_CHARS) {
        return whole;
    }
    const render = (cap) => JSON.stringify(payload, (_key, value) => typeof value === 'string' && value.length > cap ? headTail(value, cap) : value);
    const floor = render(MIN_LEAF_CHARS);
    if (floor.length > TOOL_RESULT_MAX_CHARS) {
        return floor;
    }
    let fits = MIN_LEAF_CHARS;
    let over = whole.length;
    while (over - fits > 1) {
        const mid = Math.floor((fits + over) / 2);
        if (render(mid).length <= TOOL_RESULT_MAX_CHARS) {
            fits = mid;
        }
        else {
            over = mid;
        }
    }
    return render(fits);
}
export function toolResultHistoryEntry({ name, id, output, resultRef }) {
    return resultRef
        ? {
            type: 'qvac-failure-result-ref',
            ref: resultRef,
            callId: id
        }
        : { role: 'tool', content: toolResultTurn(name, id, output) };
}
export function materializeCompletionHistory(history, values) {
    return history.map((entry) => {
        if (!isFailureResultReference(entry)) {
            return entry;
        }
        const stored = values[entry.ref];
        if (!stored) {
            throw new Error(`History references missing failed tool result: ${entry.ref}`);
        }
        const content = toolResultTurn(stored.name, entry.callId, readFailureResult(stored.result));
        return {
            role: 'tool',
            content: entry.compactedTo === undefined ? content : compactContent(content, entry.compactedTo)
        };
    });
}
export function redactFailureTurns(history, failures, redact) {
    const out = [...history];
    for (const { at, name, callId, result, compactedTo } of redact(failures)) {
        const content = toolResultTurn(name, callId, readFailureResult(result));
        out[at] = {
            role: 'tool',
            content: compactedTo === undefined ? content : compactContent(content, compactedTo)
        };
    }
    return out;
}
export function skillLoadedTurn(name, id = DIRECT_CALL_ID) {
    return toolResultTurn(Agent.SKILL_TOOL_NAME, id, {
        name,
        content: `${name} was loaded in an earlier turn but its instructions are not in this context. Call the skill tool with this name again before doing its work.`
    });
}
function refFrom(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    if (!('attachmentId' in value) || typeof value.attachmentId !== 'string') {
        return null;
    }
    const ref = { attachmentId: value.attachmentId };
    const name = 'fileName' in value && typeof value.fileName === 'string' ? value.fileName : '';
    const dot = name.lastIndexOf('.');
    if (dot > 0) {
        ref.type = name.slice(dot + 1).toLowerCase();
    }
    return ref;
}
export function attachmentTurn(name, result) {
    const direct = refFrom(result);
    if (direct) {
        return toolResultTurn(name, DIRECT_CALL_ID, direct);
    }
    const listed = isRecord(result) ? result.attachments : undefined;
    if (!Array.isArray(listed)) {
        return null;
    }
    const refs = [];
    for (const entry of listed) {
        const ref = refFrom(entry);
        if (ref) {
            refs.push(ref);
        }
    }
    if (!refs.length) {
        return null;
    }
    return toolResultTurn(name, DIRECT_CALL_ID, { attachments: refs });
}
export function loadedSkillsFrom(messages) {
    const loaded = new Set();
    for (const { name } of skillLoadPayloads(messages)) {
        loaded.add(name);
    }
    return loaded;
}
export function loadedSkillFilesFrom(messages) {
    const loaded = new Map();
    for (const { name, file } of skillLoadPayloads(messages)) {
        if (!file)
            continue;
        const files = loaded.get(name) ?? new Set();
        files.add(file);
        loaded.set(name, files);
    }
    return loaded;
}
function* skillLoadPayloads(messages) {
    for (const turn of messages) {
        const payload = skillLoadPayload(turn);
        if (payload) {
            yield payload;
        }
    }
}
function skillLoadPayload(turn) {
    if (turn.role !== 'tool')
        return null;
    const text = String(turn.content ?? '');
    const head = `[Tool: ${Agent.SKILL_TOOL_NAME} (${PRELOAD_ID_PREFIX}`;
    if (text.startsWith(head)) {
        return { name: text.slice(head.length, text.indexOf(')]', head.length)) };
    }
    if (!text.startsWith(`[Tool: ${Agent.SKILL_TOOL_NAME} (`)) {
        return null;
    }
    try {
        const payload = JSON.parse(text.split('\n', 2)[1] ?? '');
        if (typeof payload !== 'object' || payload === null) {
            return null;
        }
        if (!('name' in payload) || typeof payload.name !== 'string') {
            return null;
        }
        return 'file' in payload && typeof payload.file === 'string'
            ? { name: payload.name, file: payload.file }
            : { name: payload.name };
    }
    catch {
        return null;
    }
}
const HOST_ONLY_KEYS = ['data', 'hostNotice'];
export function historyPayload(output) {
    if (!output || typeof output !== 'object')
        return output;
    if (!HOST_ONLY_KEYS.some((key) => key in output))
        return output;
    const rest = { ...output };
    for (const key of HOST_ONLY_KEYS) {
        delete rest[key];
    }
    return rest;
}
