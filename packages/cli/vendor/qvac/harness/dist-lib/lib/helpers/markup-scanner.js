const ASCII_WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f']);
export const MAX_MARKUP_NAME_LENGTH = 64;
function lowerAscii(char) {
    return char.toLowerCase();
}
function isWhitespace(char) {
    return char !== undefined && ASCII_WHITESPACE.has(char);
}
function skipBoundedWhitespace(text, start, bound) {
    let cursor = start;
    while (isWhitespace(text[cursor]) && cursor - start < bound) {
        cursor++;
    }
    return isWhitespace(text[cursor]) ? -1 : cursor;
}
function validNameEnd(text, start, maxLength) {
    const limit = Math.min(text.length, start + maxLength + 1);
    for (let index = start; index < limit; index++) {
        const char = text[index];
        if (char === '>') {
            return index === start ? -2 : { nameEnd: index, closerAt: index };
        }
        if (char === '<') {
            return -2;
        }
        if (isWhitespace(char)) {
            if (index === start) {
                return -2;
            }
            const closerAt = skipBoundedWhitespace(text, index, MAX_MARKUP_NAME_LENGTH);
            if (closerAt === -1) {
                return -2;
            }
            if (closerAt === text.length) {
                return -1;
            }
            return text[closerAt] === '>' ? { nameEnd: index, closerAt } : -2;
        }
    }
    return -1;
}
function partialPrefix(haystack, start, value) {
    const available = haystack.slice(start);
    return available.length < value.length && value.startsWith(available);
}
function parseOpen(ctx, start) {
    const prefix = `<${ctx.tag}`;
    if (partialPrefix(ctx.haystack, start, prefix)) {
        return 'partial';
    }
    if (!ctx.haystack.startsWith(prefix, start)) {
        return null;
    }
    const cursor = skipBoundedWhitespace(ctx.haystack, start + prefix.length, MAX_MARKUP_NAME_LENGTH);
    if (cursor === -1) {
        return null;
    }
    if (cursor === ctx.text.length) {
        return 'partial';
    }
    if (ctx.haystack[cursor] !== '=') {
        return null;
    }
    return parseName(ctx, start, cursor + 1);
}
function parseName(ctx, start, nameStart) {
    const cursor = skipBoundedWhitespace(ctx.haystack, nameStart, MAX_MARKUP_NAME_LENGTH);
    if (cursor === -1) {
        return null;
    }
    if (cursor === ctx.text.length) {
        return 'partial';
    }
    const end = validNameEnd(ctx.text, cursor, ctx.maxNameLength);
    if (end === -2) {
        return null;
    }
    if (end === -1) {
        return ctx.text.length - cursor <= ctx.maxNameLength ? 'partial' : null;
    }
    return { kind: 'open', start, end: end.closerAt + 1, name: ctx.text.slice(cursor, end.nameEnd) };
}
function parseAt(ctx, start) {
    const close = `</${ctx.tag}>`;
    if (ctx.haystack.startsWith(close, start)) {
        return { kind: 'close', start, end: start + close.length };
    }
    if (partialPrefix(ctx.haystack, start, close)) {
        return 'partial';
    }
    return parseOpen(ctx, start);
}
function scanNamedMarkupIn(ctx, from = 0) {
    let cursor = from;
    for (;;) {
        const start = ctx.haystack.indexOf('<', cursor);
        if (start === -1) {
            return { token: null, partial: -1 };
        }
        const parsed = parseAt(ctx, start);
        if (parsed === 'partial') {
            return { token: null, partial: start };
        }
        if (parsed) {
            return { token: parsed, partial: -1 };
        }
        cursor = start + 1;
    }
}
function makeContext(text, tag, { maxNameLength, haystack }) {
    return { text, haystack: haystack ?? text.replace(/[A-Z]/g, lowerAscii), tag, maxNameLength };
}
export function scanNamedMarkup(text, tag, { from = 0, maxNameLength = MAX_MARKUP_NAME_LENGTH, haystack } = {}) {
    return scanNamedMarkupIn(makeContext(text, tag, { maxNameLength, haystack }), from);
}
function nextBlock(ctx, from) {
    let scan = scanNamedMarkupIn(ctx, from);
    while (scan.token?.kind === 'close') {
        scan = scanNamedMarkupIn(ctx, scan.token.end);
    }
    const open = scan.token;
    if (!open || open.kind !== 'open') {
        return null;
    }
    let nested = false;
    let cursor = open.end;
    for (;;) {
        const next = scanNamedMarkupIn(ctx, cursor).token;
        if (!next) {
            return null;
        }
        if (next.kind === 'close') {
            return {
                name: open.name ?? '',
                body: ctx.text.slice(open.end, next.start),
                start: open.start,
                end: next.end,
                nested
            };
        }
        nested = true;
        cursor = next.end;
    }
}
export function* namedMarkupBlocks(text, tag, maxNameLength = MAX_MARKUP_NAME_LENGTH) {
    const ctx = makeContext(text, tag, { maxNameLength });
    let cursor = 0;
    for (;;) {
        const block = nextBlock(ctx, cursor);
        if (!block) {
            return;
        }
        yield block;
        cursor = block.end;
    }
}
