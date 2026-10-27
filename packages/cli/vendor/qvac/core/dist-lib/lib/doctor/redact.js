const REDACTED_KEYS = new Set(['meshSeed', 'seed', 'secretKey', 'host']);
const HEX_KEY = /^[0-9a-f]{32,}$/i;
const INVITE = /^qvac:\/\//;
export const REDACTED = '‹redacted›';
export function truncateHex(value) {
    return `${value.slice(0, 8)}…${value.slice(-8)}`;
}
export function redactString(value) {
    if (INVITE.test(value))
        return REDACTED;
    if (HEX_KEY.test(value)) {
        return truncateHex(value);
    }
    return value;
}
export function redact(value) {
    if (typeof value === 'string') {
        return redactString(value);
    }
    if (Array.isArray(value)) {
        return value.map(redact);
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        out[key] = REDACTED_KEYS.has(key) ? REDACTED : redact(child);
    }
    return out;
}
