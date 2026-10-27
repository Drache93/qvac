import { Fold } from './fold/index.js';
export const TOOL_RESULT_TRUNCATION_MARKER = '\n[tool result truncated for context]\n';
export const TOOL_SEARCH_RESULT = '{"tool_search":';
const compactedSources = new WeakMap();
export function compactedFrom(message) {
    return compactedSources.get(message);
}
export function contextCandidates(history, ...nudges) {
    const isBoundary = (message) => Fold.isTurn(message, nudges);
    const { prefix, turns } = splitTurns(history, isBoundary);
    if (!turns.length) {
        return [{ history, droppedTurns: 0 }];
    }
    const maxDropped = Math.max(0, turns.length - 1);
    const candidates = dropCounts(maxDropped).map((droppedTurns) => ({
        history: droppedTurns ? [...prefix, ...turns.slice(droppedTurns).flat()] : history,
        droppedTurns
    }));
    appendToolCompactions(candidates, isBoundary);
    return candidates;
}
function splitTurns(history, isBoundary) {
    const firstUser = history.findIndex(isBoundary);
    if (firstUser === -1) {
        return { prefix: history, turns: [] };
    }
    const prefix = history.slice(0, firstUser);
    const starts = [];
    for (const [i, message] of history.entries()) {
        if (i >= firstUser && isBoundary(message)) {
            starts.push(i);
        }
    }
    const turns = starts.map((start, index) => history.slice(start, starts[index + 1]));
    return { prefix, turns };
}
function dropCounts(max) {
    const counts = [0];
    let last = 0;
    for (let step = 1; last < max; step *= 2) {
        const next = Math.min(max, step);
        if (next === last) {
            continue;
        }
        counts.push(next);
        last = next;
    }
    return counts;
}
function appendToolCompactions(candidates, isBoundary) {
    const last = candidates[candidates.length - 1];
    if (!last) {
        return;
    }
    const tools = compactableTools(last.history, isBoundary);
    let history = last.history;
    while (true) {
        const selected = longestTool(tools);
        if (!selected) {
            return;
        }
        selected.target = Math.max(TOOL_RESULT_TRUNCATION_MARKER.length, Math.floor(selected.target / 2));
        history = history.map(compactTool.bind(null, selected));
        candidates.push({ history, droppedTurns: last.droppedTurns });
    }
}
function compactableTools(history, isBoundary) {
    const newestUser = history.findLastIndex(isBoundary);
    if (newestUser === -1) {
        return [];
    }
    const tools = [];
    for (const [index, message] of history.entries()) {
        if (index <= newestUser || message.role !== 'tool')
            continue;
        if (message.content.length <= TOOL_RESULT_TRUNCATION_MARKER.length)
            continue;
        if (message.content.startsWith(TOOL_SEARCH_RESULT)) {
            continue;
        }
        tools.push({ index, source: message, target: message.content.length });
    }
    return tools;
}
function longestTool(tools) {
    return tools
        .filter((tool) => tool.target > TOOL_RESULT_TRUNCATION_MARKER.length)
        .sort((a, b) => b.target - a.target)[0];
}
export function compactContent(content, target) {
    const retained = target - TOOL_RESULT_TRUNCATION_MARKER.length;
    const head = Math.ceil(retained / 2);
    const tail = Math.floor(retained / 2);
    return `${content.slice(0, head)}${TOOL_RESULT_TRUNCATION_MARKER}${tail ? content.slice(-tail) : ''}`;
}
function compactTool(selected, message, index) {
    if (index !== selected.index)
        return message;
    const compacted = {
        ...message,
        content: compactContent(selected.source.content, selected.target)
    };
    compactedSources.set(compacted, selected.source);
    return compacted;
}
