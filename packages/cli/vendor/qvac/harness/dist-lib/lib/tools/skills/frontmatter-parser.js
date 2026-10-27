import { parseManifestBlock } from './manifest-parse.js';
import { isMentionHandle } from './mention-name.js';
export { credentialSlots } from './credential-slots.js';
export { readSetup as readSkillSetup } from './manifest-parse.js';
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FIELD_RE = /^([A-Za-z_][\w-]*):(.*)$/;
export function parseSkillFrontMatter(raw) {
    try {
        const match = FRONT_MATTER_RE.exec(raw);
        if (!match) {
            return { meta: {}, body: raw };
        }
        const block = match[1] ?? '';
        const meta = { ...parseFields(block), ...parseManifestBlock(block) };
        return { meta, body: (match[2] ?? '').trim() };
    }
    catch {
        return { meta: {}, body: raw };
    }
}
function unwrap(lines) {
    const out = [];
    for (const line of lines) {
        if (out.length > 0 && /^\s/.test(line) && line.trim().length > 0) {
            out[out.length - 1] += ` ${line.trim()}`;
        }
        else {
            out.push(line);
        }
    }
    return out;
}
function parseFields(block) {
    const meta = {};
    for (const line of unwrap(block.split(/\r?\n/))) {
        const field = FIELD_RE.exec(line);
        if (!field) {
            continue;
        }
        const key = field[1] ?? '';
        const value = (field[2] ?? '').trim();
        if (!value) {
            continue;
        }
        if (key === 'allow_list') {
            meta.allowList = parseList(value);
        }
        else if (key === 'mcp_reads') {
            meta.mcpReads = parseList(value);
        }
        else if (key === 'tools' ||
            key === 'platform' ||
            key === 'credentials' ||
            key === 'aliases') {
            meta[key] = parseList(value);
        }
        else if (key === 'name' || key === 'description') {
            meta[key] = stripQuotes(value);
        }
        else if (key === 'display_name' && isMentionHandle(stripQuotes(value))) {
            meta.displayName = stripQuotes(value);
        }
        else if (key === 'preload_on_name') {
            meta.preloadOnName = stripQuotes(value).toLowerCase() !== 'false';
        }
    }
    return meta;
}
function parseList(value) {
    const inline = /^\[(.*)\]$/.exec(value);
    const items = inline ? (inline[1] ?? '') : value.replace(/(^|\s)-\s+/g, ',');
    return items
        .split(',')
        .map((item) => stripQuotes(item.trim()))
        .filter((item) => item.length > 0);
}
function stripQuotes(value) {
    return value.replace(/^["']|["']$/g, '');
}
