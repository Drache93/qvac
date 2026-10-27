import { decodeHtmlEntities } from '../helpers/html-helpers.js';
const LDJSON_SCRIPT = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const JSON_SCRIPT = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)(?![^>]*type=["']application\/(?:ld\+)?json["'])[^>]*>([\s\S]*?)<\/script>/gi;
const STRING_LITERAL = /"(?:\\.|[^"\\])*"/g;
const META_TAG = /<meta\s[^>]*>/gi;
const META_ATTR = /(?:property|name)=["'](og:title|og:description|og:site_name|description)["']/i;
const META_CONTENT = /content=["']([^"']+)["']/i;
const MAX_HARVESTED_STRINGS = 200;
const MIN_PROSE_CHARS = 40;
const STRUCTURED_PROSE_KEYS = new Set(['headline', 'articleBody', 'description', 'text', 'name']);
export function extractEmbeddedState(html) {
    const parts = [
        ...structuredData(html),
        ...hydrationProse(html),
        ...scriptLiteralProse(html),
        ...metaTags(html)
    ];
    return dedupe(parts).join('\n');
}
function structuredData(html) {
    const out = [];
    for (const match of html.matchAll(LDJSON_SCRIPT)) {
        const value = parseJson(match[1] ?? '');
        if (value === null) {
            continue;
        }
        walk(value, (key, text) => {
            if (STRUCTURED_PROSE_KEYS.has(key)) {
                out.push(text);
            }
        });
    }
    return out;
}
function hydrationProse(html) {
    const out = [];
    for (const match of html.matchAll(JSON_SCRIPT)) {
        const value = parseJson(match[1] ?? '');
        if (value === null) {
            continue;
        }
        walk(value, (_key, text) => {
            if (looksLikeProse(text)) {
                out.push(text);
            }
        });
    }
    return out;
}
function scriptLiteralProse(html) {
    const out = [];
    for (const match of html.matchAll(INLINE_SCRIPT)) {
        for (const literal of (match[1] ?? '').match(STRING_LITERAL) ?? []) {
            if (literal.length < MIN_PROSE_CHARS)
                continue;
            const decoded = parseJson(literal);
            if (typeof decoded !== 'string') {
                continue;
            }
            const inner = decoded.trimStart().startsWith('{') ? parseJson(decoded) : null;
            if (inner !== null) {
                walk(inner, (_key, text) => {
                    if (looksLikeProse(text)) {
                        out.push(text);
                    }
                });
            }
            else if (looksLikeProse(decoded.trim())) {
                out.push(decoded.trim());
            }
        }
    }
    return out;
}
function metaTags(html) {
    const out = [];
    for (const match of html.matchAll(META_TAG)) {
        const tag = match[0];
        if (!META_ATTR.test(tag)) {
            continue;
        }
        const content = META_CONTENT.exec(tag)?.[1];
        if (content) {
            out.push(decodeHtmlEntities(content).trim());
        }
    }
    return out;
}
function parseJson(raw) {
    if (!raw.trim())
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function walk(value, visit, key = '') {
    if (typeof value === 'string') {
        const text = value.trim();
        if (text) {
            visit(key, text);
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            walk(entry, visit, key);
        }
        return;
    }
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            walk(v, visit, k);
        }
    }
}
function looksLikeProse(text) {
    if (text.length < MIN_PROSE_CHARS)
        return false;
    if (/^(?:https?:|data:|\/|#|\.)/.test(text))
        return false;
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    if (letters / text.length <= 0.6) {
        return false;
    }
    return text.includes(' ') || /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);
}
function dedupe(parts) {
    const seen = new Set();
    const out = [];
    for (const part of parts) {
        if (out.length >= MAX_HARVESTED_STRINGS)
            break;
        if (seen.has(part))
            continue;
        seen.add(part);
        out.push(part);
    }
    return out;
}
