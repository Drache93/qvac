import { isRecord } from '../../guards.js';
export const PDF_ACTIONS = [
    'create',
    'merge',
    'split',
    'rotate',
    'watermark',
    'fill',
    'encrypt',
    'decrypt',
    'text'
];
export const PAGE_SIZES = ['A4', 'A5', 'Letter', 'Legal'];
export const DEGREES = [90, 180, 270];
export const WHERE_IDS_ARE = 'copy the id from the [Attached file "…" — attachmentId: …] line or an earlier tool result';
const MAX_PAGE_SPAN = 10_000;
const PAGES_HINT = 'pages must be page numbers counted from 1, like [1, 2, 3]';
function pageRange(part) {
    const range = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!range) {
        return null;
    }
    const from = Number(range[1]);
    const to = Number(range[2] ?? range[1]);
    if (Math.abs(to - from) > MAX_PAGE_SPAN) {
        return null;
    }
    const step = from <= to ? 1 : -1;
    const pages = [from];
    for (let page = from; page !== to; page += step) {
        pages.push(page + step);
    }
    return pages;
}
function pageItem(item) {
    if (typeof item === 'number') {
        return Number.isInteger(item) ? [item] : null;
    }
    if (typeof item !== 'string')
        return null;
    const pages = [];
    for (const part of item.split(',')) {
        const range = pageRange(part);
        if (!range) {
            return null;
        }
        pages.push(...range);
    }
    return pages;
}
export function parsePages(value) {
    const items = Array.isArray(value) ? value : [value];
    if (!items.length) {
        return PAGES_HINT;
    }
    const pages = [];
    for (const item of items) {
        const parsed = pageItem(item);
        if (!parsed) {
            return PAGES_HINT;
        }
        pages.push(...parsed);
    }
    return pages;
}
function optionalPages(value) {
    if (value === undefined || value === null)
        return undefined;
    const pages = parsePages(value);
    return typeof pages === 'string' ? { error: pages } : pages;
}
function textOf(value) {
    if (typeof value === 'number') {
        return String(value);
    }
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function idsOf(args) {
    const list = [];
    if (args.attachmentId !== undefined && args.attachmentId !== null) {
        list.push(args.attachmentId);
    }
    if (Array.isArray(args.attachmentIds)) {
        list.push(...args.attachmentIds);
    }
    else if (args.attachmentIds !== undefined && args.attachmentIds !== null) {
        return { error: 'attachmentIds must be an array of ids' };
    }
    const ids = [];
    for (const id of list) {
        if (typeof id !== 'string' || !id.trim()) {
            return { error: 'attachment ids must be non-empty strings' };
        }
        if (!ids.includes(id.trim())) {
            ids.push(id.trim());
        }
    }
    return ids;
}
function isAction(name) {
    return PDF_ACTIONS.some((action) => action === name);
}
function hasOutput(args, extension) {
    return typeof args.output === 'string' && args.output.trim().toLowerCase().endsWith(extension);
}
function idCount(args) {
    const many = Array.isArray(args.attachmentIds) ? args.attachmentIds.length : 0;
    return many + (typeof args.attachmentId === 'string' ? 1 : 0);
}
const IMPLIED = [
    [(args) => typeof args.markdown === 'string', 'create'],
    [(args) => args.degrees !== undefined, 'rotate'],
    [(args) => args.values !== undefined, 'fill'],
    [(args) => typeof args.text === 'string', 'watermark'],
    [(args) => args.ownerPassword !== undefined || args.permissions !== undefined, 'encrypt'],
    [(args) => hasOutput(args, '.txt'), 'text'],
    [(args) => hasOutput(args, '.pdf') && idCount(args) > 1, 'merge'],
    [(args) => hasOutput(args, '.pdf') && args.pages !== undefined, 'split']
];
export function impliedAction(args) {
    return IMPLIED.find(([applies]) => applies(args))?.[1] ?? 'read';
}
function actionOf(args) {
    const { action } = args;
    if (action === undefined || action === null || action === '' || action === 'read') {
        return impliedAction(args);
    }
    if (typeof action !== 'string') {
        return { error: 'action must be a string' };
    }
    const name = action.trim().toLowerCase();
    if (isAction(name)) {
        return name;
    }
    return {
        error: `unknown action "${action}"; actions are ${PDF_ACTIONS.join(', ')}, or leave action out to read a PDF`
    };
}
export function pageSizeOf(value) {
    if (typeof value !== 'string')
        return undefined;
    return PAGE_SIZES.find((size) => size.toLowerCase() === value.trim().toLowerCase());
}
export function quarterTurn(value) {
    const degrees = Number(value);
    if (!Number.isInteger(degrees)) {
        return undefined;
    }
    const turn = ((degrees % 360) + 360) % 360;
    return DEGREES.find((allowed) => allowed === turn);
}
function fieldValues(value) {
    if (!isRecord(value) || Array.isArray(value))
        return undefined;
    const values = {};
    for (const [name, entry] of Object.entries(value)) {
        const ok = typeof entry === 'string' ||
            typeof entry === 'number' ||
            typeof entry === 'boolean' ||
            (Array.isArray(entry) && entry.every((item) => typeof item === 'string'));
        if (!ok) {
            return undefined;
        }
        values[name] = entry;
    }
    return Object.keys(values).length ? values : undefined;
}
function permissionsOf(value) {
    if (!isRecord(value))
        return undefined;
    const permissions = {};
    for (const key of [
        'print',
        'modify',
        'copy',
        'annotate',
        'fillForms',
        'extract',
        'assemble',
        'printHighQuality'
    ]) {
        const allowed = value[key];
        if (typeof allowed === 'boolean') {
            permissions[key] = allowed;
        }
    }
    return permissions;
}
function countError(action, count) {
    if (action === 'create') {
        return null;
    }
    if (!count) {
        const create = action === 'read' ? ', or action "create" with markdown to make one' : '';
        return `pass the attachmentId of a PDF (${WHERE_IDS_ARE})${create}`;
    }
    if (action === 'merge' && count < 2) {
        return 'merge needs attachmentIds with at least two PDFs, in the order to join them';
    }
    if (action !== 'read' && action !== 'merge' && count > 1) {
        return `${action} works on one PDF; pass a single attachmentId`;
    }
    return null;
}
function unquoted(markdown) {
    const trimmed = markdown.trim();
    if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
        return markdown;
    }
    try {
        const inner = JSON.parse(trimmed);
        return typeof inner === 'string' ? inner : markdown;
    }
    catch {
        return markdown;
    }
}
function createRequest(common, args) {
    const written = textOf(args.markdown);
    const markdown = written && unquoted(written);
    if (!markdown) {
        return { error: 'create needs markdown: the whole document as Markdown' };
    }
    const pageSize = pageSizeOf(args.pageSize);
    if (args.pageSize !== undefined && !pageSize) {
        return { error: `pageSize must be one of ${PAGE_SIZES.join(', ')}` };
    }
    return {
        ...common,
        action: 'create',
        markdown,
        pageSize,
        landscape: args.landscape === true,
        pageNumbers: args.pageNumbers === true
    };
}
function watermarkRequest(common, args) {
    const text = textOf(args.text);
    if (!text) {
        return { error: 'watermark needs text' };
    }
    const opacity = args.opacity === undefined ? undefined : Number(args.opacity);
    if (opacity !== undefined && !(opacity >= 0 && opacity <= 1)) {
        return { error: 'opacity must be between 0 and 1' };
    }
    const { position } = args;
    if (position !== undefined && position !== 'over' && position !== 'under') {
        return { error: 'position must be "over" or "under"' };
    }
    const pages = optionalPages(args.pages);
    if (isError(pages)) {
        return pages;
    }
    return { ...common, action: 'watermark', text, opacity, position, pages };
}
function pagedRequest(common, action, args) {
    const pages = optionalPages(args.pages);
    if (isError(pages)) {
        return pages;
    }
    if (action === 'split') {
        if (!pages) {
            return { error: 'split needs pages: the page numbers to keep, counted from 1' };
        }
        return { ...common, action, pages };
    }
    const degrees = quarterTurn(args.degrees);
    if (degrees === undefined) {
        return { error: 'degrees must be 90, 180 or 270, clockwise' };
    }
    return { ...common, action, degrees, pages };
}
function actionRequest(action, common, args) {
    switch (action) {
        case 'create':
            return createRequest(common, args);
        case 'split':
        case 'rotate':
            return pagedRequest(common, action, args);
        case 'watermark':
            return watermarkRequest(common, args);
        case 'fill': {
            const values = fieldValues(args.values);
            if (!values) {
                return {
                    error: 'fill needs values: { "field name": value } using the field names a read returns'
                };
            }
            return { ...common, action, values };
        }
        case 'encrypt':
            if (!common.password) {
                return { error: 'encrypt needs password: the password the user chose' };
            }
            return {
                ...common,
                action,
                ownerPassword: textOf(args.ownerPassword),
                permissions: permissionsOf(args.permissions)
            };
        case 'decrypt':
            if (!common.password) {
                return { error: 'decrypt needs password: ask the user for it, never guess one' };
            }
            return { ...common, action };
        default:
            return { ...common, action };
    }
}
function isError(value) {
    return isRecord(value) && 'error' in value && typeof value.error === 'string';
}
export function parseRequest(args) {
    const action = actionOf(args);
    if (isError(action)) {
        return action.error;
    }
    const ids = idsOf(args);
    if (isError(ids)) {
        return ids.error;
    }
    const counted = countError(action, ids.length);
    if (counted) {
        return counted;
    }
    if (args.password !== undefined && args.password !== null && !textOf(args.password)) {
        return 'password must be a non-empty string';
    }
    if (args.output !== undefined && args.output !== null && !textOf(args.output)) {
        return 'output must be a file name';
    }
    const output = textOf(args.output)?.trim();
    const request = actionRequest(action, { ids, password: textOf(args.password), output }, args);
    return isError(request) ? request.error : request;
}
