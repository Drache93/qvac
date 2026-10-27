import { isRecord } from '../guards.js';
import { namedMarkupBlocks, scanNamedMarkup } from './markup-scanner.js';
const TOOL_RESPONSE = { open: '<tool_response>', close: '</tool_response>' };
const TOOL_CALL = { open: '<tool_call>', close: '</tool_call>' };
const MAX_NAME_LENGTH = 64;
export const MAX_RAW_CALL_CHARS = 4096;
export const MALFORMED_CALL_ID = 'call-malformed';
export function clipRawCall(raw) {
    return raw.length > MAX_RAW_CALL_CHARS ? raw.slice(0, MAX_RAW_CALL_CHARS) : raw;
}
export function recoverMarkupToolCalls(text, knownTools) {
    const known = new Set(knownTools.map((tool) => tool.name));
    const calls = [];
    for (const block of namedMarkupBlocks(text, 'function', MAX_NAME_LENGTH)) {
        if (block.nested) {
            calls.push(...recoverLegacyCalls(text.slice(block.start, block.end), known));
            continue;
        }
        if (!block.name || !known.has(block.name)) {
            continue;
        }
        calls.push({
            id: '',
            name: block.name,
            arguments: decodeArguments(block.body).args,
            raw: clipRawCall(text.slice(block.start, block.end))
        });
    }
    return calls.map((call, index) => ({ ...call, id: `recovered-markup-${index}` }));
}
function recoverLegacyCalls(text, known) {
    const calls = [];
    let cursor = 0;
    for (;;) {
        const start = text.indexOf('<function=', cursor);
        if (start === -1) {
            return calls;
        }
        const nameStart = start + '<function='.length;
        const nameEnd = text.indexOf('>', nameStart);
        const close = nameEnd === -1 ? -1 : text.indexOf('</function>', nameEnd + 1);
        if (nameEnd === -1 || nameEnd - nameStart > MAX_NAME_LENGTH || close === -1) {
            return calls;
        }
        const name = text.slice(nameStart, nameEnd).trim();
        const end = close + '</function>'.length;
        if (name && known.has(name)) {
            calls.push({
                id: '',
                name,
                arguments: decodeLegacyArguments(text.slice(nameEnd + 1, close), 64),
                raw: clipRawCall(text.slice(start, end))
            });
        }
        cursor = end;
    }
}
export function redactToolCallMarkup(text, redactArgs) {
    let out = '';
    let cursor = 0;
    let changed = false;
    for (const block of namedMarkupBlocks(text, 'function', Infinity)) {
        const replacement = redactedMarkupBlock(block, redactArgs);
        if (replacement === null) {
            continue;
        }
        out += text.slice(cursor, block.start) + replacement;
        cursor = block.end;
        changed = true;
    }
    out += text.slice(cursor);
    return changed ? out : text;
}
function redactedMarkupBlock(block, redactArgs) {
    if (block.nested) {
        return '<function=redacted></function>';
    }
    const { args: decoded, ambiguous } = decodeArguments(block.body, Infinity);
    if (ambiguous) {
        return `<function=${block.name}></function>`;
    }
    const redacted = redactArgs(block.name, decoded);
    const replacement = deepEqual(decoded, redacted)
        ? null
        : functionMarkup({ name: block.name, arguments: redacted });
    return replacement;
}
export function redactBareParameterMarkup(text, isSensitiveName) {
    if (!/<parameter/i.test(text)) {
        return text;
    }
    let out = '';
    let cursor = 0;
    let changed = false;
    for (;;) {
        const open = scanNamedMarkup(text, 'parameter', { from: cursor, maxNameLength: Infinity }).token;
        if (!open) {
            break;
        }
        if (open.kind === 'close' || !isSensitiveName(open.name ?? '')) {
            cursor = open.end;
            continue;
        }
        const close = scanNamedMarkup(text, 'parameter', {
            from: open.end,
            maxNameLength: Infinity
        }).token;
        out += text.slice(cursor, open.end);
        changed = true;
        if (close?.kind === 'close') {
            out += `[redacted]${text.slice(close.start, close.end)}`;
            cursor = close.end;
        }
        else {
            out += '[redacted]';
            cursor = text.length;
            break;
        }
    }
    out += text.slice(cursor);
    return redactRunOnParameterOpeners(changed ? out : text, isSensitiveName);
}
function redactRunOnParameterOpeners(text, isSensitiveName) {
    const opener = /<parameter\s*=\s*([^\s<>]+)\s+(?=[^\s>])/gi;
    const closer = /<\/parameter>/gi;
    let out = '';
    let cursor = 0;
    for (let match = opener.exec(text); match; match = opener.exec(text)) {
        if (!isSensitiveName(match[1])) {
            continue;
        }
        const valueStart = match.index + match[0].length;
        closer.lastIndex = valueStart;
        const close = closer.exec(text);
        out += `${text.slice(cursor, valueStart)}[redacted]`;
        if (!close) {
            return out;
        }
        cursor = close.index;
        opener.lastIndex = close.index;
    }
    return cursor === 0 ? text : out + text.slice(cursor);
}
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => deepEqual(value, b[index]));
    }
    if (!isRecord(a) || !isRecord(b)) {
        return false;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    return aKeys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}
export function stripToolCallMarkup(text) {
    let out = '';
    let cursor = 0;
    for (const block of namedMarkupBlocks(text, 'function', MAX_NAME_LENGTH)) {
        out += text.slice(cursor, block.start);
        cursor = block.end;
    }
    out += text.slice(cursor);
    const withoutSpans = stripSpans(stripToolResponseBlocks(out), TOOL_CALL);
    return withoutSpans
        .replace(/<\/?(tool_call|tool_response)>/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
function lowerAscii(char) {
    return char.toLowerCase();
}
function stripSpans(text, span) {
    const hay = text.replace(/[A-Z]/g, lowerAscii);
    let out = '';
    let cursor = 0;
    for (;;) {
        const start = hay.indexOf(span.open, cursor);
        if (start === -1) {
            break;
        }
        out += text.slice(cursor, start);
        const end = hay.indexOf(span.close, start + span.open.length);
        if (end === -1) {
            return out;
        }
        cursor = end + span.close.length;
    }
    return out + text.slice(cursor);
}
export function stripToolResponseBlocks(text) {
    return stripSpans(text, TOOL_RESPONSE);
}
export function toolCallMarkup(calls) {
    return calls.map(markupForCall).join('\n');
}
function markupForCall(call) {
    return `<tool_call>\n${functionMarkup(call)}\n</tool_call>`;
}
function functionMarkup(call) {
    const params = Object.entries(call.arguments ?? {})
        .map(([key, value]) => `<parameter=${key}>\n${markupValue(value)}\n</parameter>\n`)
        .join('');
    return `<function=${call.name}>\n${params}</function>`;
}
function markupValue(value) {
    return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}
const ARG_WRAPPER_KEYS = new Set(['parameters', 'arguments', 'args', 'input', 'params']);
function isPlainObject(value) {
    return isRecord(value) && !Array.isArray(value);
}
export function normalizeToolArgs(args, declaredKeys) {
    const [only, ...rest] = Object.keys(args);
    if (only === undefined || rest.length) {
        return args;
    }
    if (!ARG_WRAPPER_KEYS.has(only) || declaredKeys.includes(only)) {
        return args;
    }
    const inner = args[only];
    if (isPlainObject(inner)) {
        return inner;
    }
    if (typeof inner === 'string') {
        try {
            const parsed = JSON.parse(inner);
            if (isPlainObject(parsed)) {
                return parsed;
            }
        }
        catch {
            return args;
        }
    }
    return args;
}
function decodeArguments(block, maxNameLength = MAX_NAME_LENGTH) {
    const args = {};
    let ambiguous = false;
    for (const param of namedMarkupBlocks(block, 'parameter', maxNameLength)) {
        if (!param.name)
            continue;
        ambiguous ||= param.nested;
        defineArgument(args, param.name, param.body);
    }
    return { args: ambiguous ? decodeLegacyArguments(block, maxNameLength) : args, ambiguous };
}
function decodeLegacyArguments(block, maxNameLength) {
    const args = {};
    let cursor = 0;
    for (;;) {
        const start = block.indexOf('<parameter=', cursor);
        if (start === -1) {
            return args;
        }
        const nameStart = start + '<parameter='.length;
        const nameEnd = block.indexOf('>', nameStart);
        if (nameEnd === -1 || nameEnd - nameStart > maxNameLength) {
            return args;
        }
        const end = block.indexOf('</parameter>', nameEnd + 1);
        if (end === -1) {
            return args;
        }
        const name = block.slice(nameStart, nameEnd).trim();
        if (name) {
            defineArgument(args, name, block.slice(nameEnd + 1, end));
        }
        cursor = end + '</parameter>'.length;
    }
}
function defineArgument(args, name, body) {
    const raw = body.trim();
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        value = raw;
    }
    Object.defineProperty(args, name, { value, enumerable: true, configurable: true, writable: true });
}
export function recoverSkillNamedCall(text, skillNames, skillToolName) {
    const known = new Set(skillNames);
    for (const block of namedMarkupBlocks(text, 'function', MAX_NAME_LENGTH)) {
        if (!known.has(block.name))
            continue;
        return [
            {
                id: 'recovered-skill-named-call',
                name: skillToolName,
                arguments: { name: block.name },
                raw: clipRawCall(text.slice(block.start, block.end))
            }
        ];
    }
    return [];
}
const SKILL_LOAD_KEYS = new Set(['name', 'skill', 'skill_name', 'file', 'path', 'filename']);
export function recoverPrintedSkillLoad(text, skillToolName) {
    for (const match of text.matchAll(/\{[^{}]*\}/g)) {
        const candidate = parsePrintedCandidate(match[0]);
        if (!isPlainObject(candidate)) {
            continue;
        }
        const keys = Object.keys(candidate);
        if (keys.length === 0 || !keys.every((key) => SKILL_LOAD_KEYS.has(key))) {
            continue;
        }
        const name = candidate.name ?? candidate.skill ?? candidate.skill_name;
        const file = candidate.file ?? candidate.path ?? candidate.filename;
        if (typeof name !== 'string' || typeof file !== 'string') {
            continue;
        }
        if (!/\.(md|py)\s*$/i.test(file.replaceAll('"', '').trim())) {
            continue;
        }
        return [
            {
                id: 'recovered-printed-skill-load',
                name: skillToolName,
                arguments: { name, file },
                raw: clipRawCall(match[0])
            }
        ];
    }
    return [];
}
function parsePrintedCandidate(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
