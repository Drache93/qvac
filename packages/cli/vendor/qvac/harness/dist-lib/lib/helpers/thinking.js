import { firstMarker } from 'asenion/guards';
import { holdback } from 'asenion/scan';
import { STOP_MARKERS } from './control-tokens.js';
import { createJoinGuard } from './join-guard.js';
const OPEN_TAGS = ['<think>', '<thinking>'];
const CLOSE_TAGS = ['</think>', '</thinking>'];
const ALL_TAGS = [...OPEN_TAGS, ...CLOSE_TAGS];
const NEVER_ASSEMBLE = [...ALL_TAGS, ...STOP_MARKERS];
function findEarliest(buffer, tags) {
    const found = firstMarker(buffer, tags);
    return found === null ? null : { idx: found.index, len: found.marker.length };
}
function nextTag(buffer, inThink) {
    const open = findEarliest(buffer, OPEN_TAGS);
    const close = findEarliest(buffer, CLOSE_TAGS);
    if (inThink) {
        if (open && (!close || open.idx < close.idx)) {
            return { ...open, inThink: true };
        }
        return close && { ...close, inThink: false };
    }
    if (close && (!open || close.idx < open.idx)) {
        return { ...close, inThink: false };
    }
    return open && { ...open, inThink: true };
}
export async function* tapThinking(tokens, opts, onThinking) {
    let inThink = opts.startInThink === true;
    let tail = '';
    for await (const token of tokens) {
        const wasThinking = inThink;
        tail += token;
        let tag = firstMarker(tail, inThink ? CLOSE_TAGS : OPEN_TAGS);
        while (tag) {
            tail = tail.slice(tag.index + tag.marker.length);
            inThink = !inThink;
            tag = firstMarker(tail, inThink ? CLOSE_TAGS : OPEN_TAGS);
        }
        tail = tail.slice(tail.length - holdback(tail, inThink ? CLOSE_TAGS : OPEN_TAGS));
        if (wasThinking && inThink) {
            onThinking();
        }
        yield token;
    }
}
export async function* splitThinking(tokens, opts) {
    let buffer = '';
    let inThink = opts?.startInThink === true;
    let unproven = inThink ? '' : null;
    const guards = {
        thinking: createJoinGuard(NEVER_ASSEMBLE),
        content: createJoinGuard(NEVER_ASSEMBLE)
    };
    const emit = (type, text) => {
        const shown = guards[type].push(text);
        if (!shown) {
            return null;
        }
        if (type === 'thinking' && unproven !== null) {
            unproven += shown;
        }
        return { type, text: shown };
    };
    for await (const token of tokens) {
        buffer += token;
        while (true) {
            const tag = nextTag(buffer, inThink);
            if (!tag) {
                break;
            }
            const type = inThink ? 'thinking' : 'content';
            const event = emit(type, buffer.slice(0, tag.idx));
            if (event) {
                yield event;
            }
            guards[type].cut();
            buffer = buffer.slice(tag.idx + tag.len);
            if (inThink && !tag.inThink) {
                unproven = null;
            }
            inThink = tag.inThink;
        }
        const held = holdback(buffer, inThink ? CLOSE_TAGS : ALL_TAGS);
        if (buffer.length > held) {
            const event = emit(inThink ? 'thinking' : 'content', buffer.slice(0, buffer.length - held));
            if (event) {
                yield event;
            }
            buffer = buffer.slice(buffer.length - held);
        }
    }
    const last = emit(inThink ? 'thinking' : 'content', buffer);
    if (last) {
        yield last;
    }
    for (const type of ['thinking', 'content']) {
        const rest = guards[type].flush();
        if (!rest) {
            continue;
        }
        if (type === 'thinking' && unproven !== null) {
            unproven += rest;
        }
        yield { type, text: rest };
    }
    return unproven;
}
