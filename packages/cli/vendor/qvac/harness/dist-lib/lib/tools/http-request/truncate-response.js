import { MAX_RESPONSE_CHARS } from './request.js';
import { isRecord } from '../../guards.js';
export function truncateResponseBody(body) {
    if (body.length <= MAX_RESPONSE_CHARS)
        return body;
    return fitJson(body) ?? `${body.slice(0, MAX_RESPONSE_CHARS)}… [truncated]`;
}
function fitJson(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return null;
    }
    return JSON.stringify(fit(parsed, MAX_RESPONSE_CHARS));
}
const MARKER_CHARS = 64;
function shrinkable(value) {
    if (typeof value === 'string')
        return true;
    return isRecord(value);
}
export const ELISION = '… [truncated]';
function fitString(value, budget) {
    const room = budget - ELISION.length - 2;
    if (room <= 0) {
        return ELISION;
    }
    return `${value.slice(0, room)}${ELISION}`;
}
function fitArray(value, room) {
    const kept = [];
    let used = 2;
    for (const item of value) {
        const size = JSON.stringify(item).length + 1;
        if (used + size > room) {
            const left = room - used;
            if (left > MARKER_CHARS && shrinkable(item)) {
                kept.push(fit(item, left));
            }
            break;
        }
        kept.push(item);
        used += size;
    }
    const dropped = value.length - kept.length;
    if (dropped > 0) {
        kept.push(`… [${dropped} more items truncated]`);
    }
    return kept;
}
function fitObject(value, room) {
    const entries = Object.entries(value);
    const out = {};
    let used = 2;
    let kept = 0;
    let refitted = false;
    for (const [key, item] of entries) {
        const keySize = JSON.stringify(key).length + 2;
        const size = keySize + JSON.stringify(item).length;
        if (used + size > room) {
            const left = room - used - keySize;
            if (!refitted && left > MARKER_CHARS && shrinkable(item)) {
                const shrunk = fit(item, left);
                out[key] = shrunk;
                used += keySize + JSON.stringify(shrunk).length;
                refitted = true;
                kept++;
            }
            continue;
        }
        out[key] = item;
        used += size;
        kept++;
    }
    if (kept < entries.length) {
        out['…'] = `[${entries.length - kept} more fields truncated]`;
    }
    return out;
}
function fit(value, budget) {
    const room = budget - MARKER_CHARS;
    if (Array.isArray(value)) {
        return fitArray(value, room);
    }
    if (isRecord(value)) {
        return fitObject(value, room);
    }
    if (typeof value === 'string' && JSON.stringify(value).length > budget) {
        return fitString(value, budget);
    }
    return value;
}
