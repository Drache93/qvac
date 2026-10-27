export function stripIPv6Brackets(hostname) {
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        return hostname.slice(1, -1);
    }
    return hostname;
}
export function isPrivateIPv4(hostname) {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
        return false;
    }
    const a = parts[0];
    const b = parts[1];
    if (a === undefined || b === undefined) {
        return false;
    }
    return (a === 10 ||
        a === 127 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a === 0 ||
        a >= 224);
}
export function isPrivateOrBlockedIPv6(address) {
    const bytes = parseIPv6ToBytes(address.toLowerCase());
    if (bytes === null) {
        return true;
    }
    if (isAllZeroBytes(bytes, 0, 16)) {
        return true;
    }
    if (isAllZeroBytes(bytes, 0, 15) && bytes[15] === 1) {
        return true;
    }
    const embeddedIPv4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    if (isAllZeroBytes(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
        return isPrivateIPv4(embeddedIPv4);
    }
    if (isAllZeroBytes(bytes, 0, 12)) {
        return isPrivateIPv4(embeddedIPv4);
    }
    const [first = 0, second = 0] = bytes;
    if ((first & 0xfe) === 0xfc) {
        return true;
    }
    if (first === 0xfe && ((second & 0xc0) === 0x80 || (second & 0xc0) === 0xc0)) {
        return true;
    }
    return first === 0xff;
}
function parseIPv6ToBytes(lower) {
    const zoneless = lower.split('%')[0] ?? '';
    const compressed = zoneless.split('::');
    if (compressed.length > 2) {
        return null;
    }
    const hasCompression = compressed.length === 2;
    const headGroups = expandEmbeddedIPv4(splitGroups(compressed[0] ?? ''));
    const tailGroups = hasCompression ? expandEmbeddedIPv4(splitGroups(compressed[1] ?? '')) : [];
    if (headGroups === null || tailGroups === null) {
        return null;
    }
    const zeroFill = 8 - headGroups.length - tailGroups.length;
    if (hasCompression ? zeroFill < 1 : zeroFill !== 0) {
        return null;
    }
    const groups = [...headGroups, ...Array(zeroFill).fill('0'), ...tailGroups];
    const bytes = new Uint8Array(16);
    for (const [i, group] of groups.entries()) {
        if (!/^[0-9a-f]{1,4}$/.test(group)) {
            return null;
        }
        const value = Number.parseInt(group, 16);
        bytes[i * 2] = (value >> 8) & 0xff;
        bytes[i * 2 + 1] = value & 0xff;
    }
    return bytes;
}
function splitGroups(segment) {
    return segment === '' ? [] : segment.split(':');
}
function expandEmbeddedIPv4(groups) {
    const last = groups[groups.length - 1];
    if (last === undefined || !last.includes('.')) {
        return [...groups];
    }
    const quad = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(last);
    if (!quad) {
        return null;
    }
    const octets = quad.slice(1, 5).map(Number);
    if (octets.some((n) => n > 255)) {
        return null;
    }
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    const hi = ((a << 8) | b).toString(16);
    const lo = ((c << 8) | d).toString(16);
    return [...groups.slice(0, -1), hi, lo];
}
function isAllZeroBytes(bytes, start, end) {
    for (let i = start; i < end; i++) {
        if (bytes[i] !== 0) {
            return false;
        }
    }
    return true;
}
const BLOCKED_HOSTNAMES = new Set([
    'metadata.google.internal',
    '169.254.169.254',
    'metadata.azure.com'
]);
export function isPrivateOrBlocked(hostname) {
    const normalized = stripIPv6Brackets(hostname).toLowerCase().replace(/\.$/, '');
    if (BLOCKED_HOSTNAMES.has(normalized)) {
        return true;
    }
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
        return true;
    }
    if (normalized.includes(':')) {
        return isPrivateOrBlockedIPv6(normalized);
    }
    return isPrivateIPv4(normalized);
}
