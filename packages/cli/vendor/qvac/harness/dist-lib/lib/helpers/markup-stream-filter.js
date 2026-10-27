import { holdback } from 'asenion/scan';
import { createJoinGuard } from './join-guard.js';
import { scanNamedMarkup } from './markup-scanner.js';
const TOOL_CALL_OPEN = '<tool_call>';
const MARKUP_OPENERS = [TOOL_CALL_OPEN, '<tool_response>'];
const MARKUP_CLOSERS = {
    '<tool_call>': '</tool_call>',
    '<tool_response>': '</tool_response>'
};
const MARKUP_MARKERS = [...MARKUP_OPENERS, ...Object.values(MARKUP_CLOSERS)];
const FUNCTION_CLOSE = '</function>';
const JOIN_MARKERS = [...MARKUP_MARKERS, '<function', '</function>', '<FUNCTION', '</FUNCTION>'];
function initialState({ onToolCall = noop }) {
    return {
        buffer: '',
        lower: '',
        markerAt: MARKUP_MARKERS.map(() => -1),
        namedFrom: 0,
        closer: null,
        held: null,
        onToolCall,
        candidate: null,
        candidateTail: '',
        stripNewline: false,
        guard: createJoinGuard(JOIN_MARKERS)
    };
}
function markerHit(state) {
    let hit = null;
    for (let i = 0; i < MARKUP_MARKERS.length; i++) {
        const index = state.markerAt[i];
        if (index !== -1 && (!hit || index < hit.index)) {
            hit = { index, marker: MARKUP_MARKERS[i] };
        }
    }
    return hit;
}
function appendBuffer(state, token) {
    const oldLength = state.buffer.length;
    state.buffer += token;
    state.lower += token.replace(/[A-Z]/g, (char) => char.toLowerCase());
    state.markerAt = state.markerAt.map((index, i) => index === -1
        ? state.buffer.indexOf(MARKUP_MARKERS[i], Math.max(0, oldLength - MARKUP_MARKERS[i].length + 1))
        : index);
}
function setBuffer(state, next) {
    const removed = state.buffer.length - next.length;
    state.lower = state.lower.slice(removed);
    state.buffer = next;
    state.namedFrom = Math.max(0, state.namedFrom - removed);
    state.markerAt = state.markerAt.map((index, i) => {
        if (index === -1)
            return -1;
        return index >= removed ? index - removed : next.indexOf(MARKUP_MARKERS[i]);
    });
}
function drain(state) {
    let out = '';
    for (;;) {
        const step = nextStep(state);
        out += step.out;
        if (step.done) {
            return out;
        }
    }
}
function nextStep(state) {
    if (state.candidate) {
        return consumeCandidate(state);
    }
    return state.closer ? consumeSuppressed(state) : emitUntilOpener(state);
}
export function createMarkupStreamFilter(options = {}) {
    const state = initialState(options);
    return {
        push(token) {
            appendBuffer(state, token);
            return drain(state);
        },
        flush() {
            dropResumeNewline(state);
            const candidate = state.candidate ? state.candidate.join('') : '';
            const visible = state.closer ? '' : candidate + state.buffer;
            const rest = state.guard.push(visible) + state.guard.flush();
            resetPending(state);
            return rest;
        }
    };
}
function resetPending(state) {
    setBuffer(state, '');
    state.closer = null;
    state.held = null;
    state.candidate = null;
    state.candidateTail = '';
    state.stripNewline = false;
}
function consumeCandidate(state) {
    const lower = state.candidateTail + state.lower;
    const closeAt = lower.indexOf(FUNCTION_CLOSE);
    if (closeAt === -1) {
        state.candidate?.push(state.buffer);
        state.candidateTail = lower.slice(-FUNCTION_CLOSE.length + 1);
        setBuffer(state, '');
        return { out: '', done: true };
    }
    const consumed = closeAt + FUNCTION_CLOSE.length - state.candidateTail.length;
    setBuffer(state, state.buffer.slice(consumed));
    state.candidate = null;
    state.candidateTail = '';
    state.stripNewline = true;
    state.guard.cut();
    return { out: '', done: false };
}
function consumeSuppressed(state) {
    const closer = state.closer ?? '';
    const end = state.buffer.indexOf(closer);
    if (end === -1) {
        const kept = state.buffer.length - holdback(state.buffer, [closer]);
        if (state.held !== null) {
            state.held += state.buffer.slice(0, kept);
        }
        setBuffer(state, state.buffer.slice(kept));
        return { out: '', done: true };
    }
    if (state.held !== null) {
        const body = state.held + state.buffer.slice(0, end);
        state.held = null;
        state.onToolCall(body);
    }
    setBuffer(state, state.buffer.slice(end + closer.length));
    state.stripNewline = true;
    state.closer = null;
    return { out: '', done: false };
}
function dropResumeNewline(state) {
    if (!state.stripNewline || state.buffer.length === 0)
        return;
    state.stripNewline = false;
    if (state.buffer[0] === '\n') {
        setBuffer(state, state.buffer.slice(1));
    }
}
function beginFunctionCandidate(state, start, end) {
    const out = state.guard.push(state.buffer.slice(0, start));
    state.candidate = [state.buffer.slice(start, end)];
    setBuffer(state, state.buffer.slice(end));
    state.candidateTail = '';
    return out;
}
function consumeFixedMarker(state, index, marker) {
    const out = state.guard.push(state.buffer.slice(0, index));
    state.guard.cut();
    setBuffer(state, state.buffer.slice(index + marker.length));
    const closer = MARKUP_CLOSERS[marker];
    state.stripNewline = closer === undefined;
    state.closer = closer ?? null;
    state.held = marker === TOOL_CALL_OPEN ? '' : null;
    return { out, done: false };
}
function scanNamedOpen(buffer, haystack, start) {
    let from = start;
    for (;;) {
        const scan = scanNamedMarkup(buffer, 'function', { from, haystack });
        if (!scan.token || scan.token.kind === 'open') {
            return scan;
        }
        from = scan.token.end;
    }
}
function emitUntilOpener(state) {
    dropResumeNewline(state);
    const marker = markerHit(state);
    const scan = scanNamedOpen(state.buffer, state.lower, state.namedFrom);
    const namedIndex = scan.token?.start ?? scan.partial;
    state.namedFrom = namedIndex === -1 ? state.buffer.length : namedIndex;
    const useNamed = namedIndex !== -1 && (!marker || namedIndex < marker.index);
    if (useNamed && scan.token) {
        return { out: beginFunctionCandidate(state, scan.token.start, scan.token.end), done: false };
    }
    if (marker && !useNamed) {
        return consumeFixedMarker(state, marker.index, marker.marker);
    }
    if (useNamed) {
        const out = state.guard.push(state.buffer.slice(0, namedIndex));
        setBuffer(state, state.buffer.slice(namedIndex));
        return { out, done: true };
    }
    const functionHold = scan.partial === -1 ? 0 : state.buffer.length - scan.partial;
    const hold = Math.max(holdback(state.buffer, MARKUP_MARKERS), functionHold);
    const out = state.guard.push(state.buffer.slice(0, state.buffer.length - hold));
    setBuffer(state, state.buffer.slice(state.buffer.length - hold));
    return { out, done: true };
}
function noop() { }
