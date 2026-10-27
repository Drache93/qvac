import { isRecord } from '../guards.js';
import { redact, truncateHex } from './redact.js';
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const BYTE_KEYS = new Set([
    'rss',
    'heapUsed',
    'heapTotal',
    'external',
    'memory'
]);
export function humanizeBytes(value) {
    if (!Number.isFinite(value) || value <= 0)
        return '0 B';
    let scaled = value;
    let unit = 0;
    while (scaled >= 1024 && unit < UNITS.length - 1) {
        scaled /= 1024;
        unit += 1;
    }
    return `${unit === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${UNITS[unit]}`;
}
function isByteKey(key) {
    return BYTE_KEYS.has(key) || key.toLowerCase().endsWith('bytes');
}
function isTimestampKey(key) {
    return key === 'at' || /[a-z]At$/.test(key);
}
const YEAR_2001_MS = 978_307_200_000;
function formatTimestamp(value) {
    return new Date(value).toISOString().replace('T', ' ').slice(0, 19);
}
export function formatValue(value, key) {
    if (value === null || value === undefined)
        return 'null';
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        const num = Number(value);
        if (isByteKey(key) && Number.isFinite(num)) {
            return humanizeBytes(num);
        }
        if (isTimestampKey(key) && num >= YEAR_2001_MS) {
            return formatTimestamp(num);
        }
        return Number.isInteger(num) ? String(num) : num.toFixed(3);
    }
    return String(value);
}
function isBranch(value) {
    return isRecord(value) || Array.isArray(value);
}
function isScalarList(value) {
    return Array.isArray(value) && value.every((item) => !isBranch(item));
}
const TEE = '├─ ';
const ELBOW = '└─ ';
const PIPE = '│  ';
const GAP = '   ';
function walk(value, prefix, out) {
    const entries = Object.entries(value);
    const inline = entries.filter(([, child]) => !isBranch(child) || isScalarList(child));
    const width = Math.max(0, ...inline.map(([key]) => key.length));
    entries.forEach(([key, child], index) => {
        const last = index === entries.length - 1;
        const head = `${prefix}${last ? ELBOW : TEE}`;
        const below = `${prefix}${last ? GAP : PIPE}`;
        if (isScalarList(child)) {
            const text = child.length ? child.map((item) => formatValue(item, key)).join(', ') : 'none';
            out.push(`${head}${key.padEnd(width)}  ${text}`);
            return;
        }
        if (Array.isArray(child)) {
            out.push(`${head}${key}`);
            walkList(child, below, out);
            return;
        }
        if (isRecord(child)) {
            if (Object.keys(child).length === 0) {
                out.push(`${head}${key.padEnd(width)}  none`);
                return;
            }
            out.push(`${head}${key}`);
            walk(child, below, out);
            return;
        }
        out.push(`${head}${key.padEnd(width)}  ${formatValue(child, key)}`);
    });
}
export function walkList(items, prefix, out) {
    const [only] = items;
    if (items.length === 1 && isRecord(only)) {
        walk(only, prefix, out);
        return;
    }
    items.forEach((item, index) => {
        const last = index === items.length - 1;
        const head = `${prefix}${last ? ELBOW : TEE}`;
        const below = `${prefix}${last ? GAP : PIPE}`;
        if (!isRecord(item)) {
            out.push(`${head}${formatValue(item, '')}`);
            return;
        }
        out.push(`${head}${index + 1}`);
        walk(item, below, out);
    });
}
const SECTIONS = [
    'deviceInfo',
    'cpu',
    'gpu',
    'mesh',
    'network',
    'process',
    'harness',
    'assistant',
    'backendUse',
    'localConfig'
];
const HEADER_KEYS = new Set(['device']);
export function headerLine(stats) {
    const frame = isRecord(stats) ? stats : {};
    const mesh = isRecord(frame['mesh']) ? frame['mesh'] : null;
    const device = frame['device'];
    const at = formatTimestamp(Date.now());
    return [
        at,
        `device ${typeof device === 'string' ? truncateHex(device) : 'none'}`,
        `mesh ${typeof mesh?.['key'] === 'string' ? truncateHex(mesh['key']) : 'none'}`
    ].join('  ·  ');
}
function sectionTitle(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
}
export function diagnosticsLines(stats) {
    const header = headerLine(stats);
    const frame = redact(stats);
    if (!isRecord(frame)) {
        return [header, '', '(no diagnostics snapshot yet)'];
    }
    const entries = Object.entries(frame);
    const out = [header];
    const loose = entries.filter(([key, value]) => !isBranch(value) && !HEADER_KEYS.has(key));
    if (loose.length) {
        out.push('');
        walk(Object.fromEntries(loose), '', out);
    }
    const branches = entries.filter(([, value]) => isBranch(value)).map(([key]) => key);
    const ordered = [
        ...SECTIONS.filter((section) => branches.includes(section)),
        ...branches.filter((key) => !SECTIONS.includes(key))
    ];
    for (const section of ordered) {
        out.push('', sectionTitle(section));
        const value = frame[section];
        if (Array.isArray(value) && value.length) {
            walkList(value, '', out);
        }
        else if (isRecord(value) && Object.keys(value).length) {
            walk(value, '', out);
        }
        else {
            out.push('└─ none');
        }
    }
    return out;
}
