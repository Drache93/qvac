import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { errorMessage, isRecord } from '../../lib/guards.js';
import { callDenyRoots, defaultRealpath, hostPath, isDeniedPath, PROTECTED_PATH_ERROR, resolveKey } from '../../lib/tools/fs/scope.js';
const OPERATIONS = ['definition', 'references', 'hover', 'symbols', 'diagnostics'];
const MAX_LOCATIONS = 30;
const MAX_OUTLINE = 100;
const MAX_DIAGNOSTICS = 50;
const MAX_HOVER_CHARS = 1_000;
const MAX_LINE_CHARS = 160;
const SYMBOL_KINDS = [
    'file',
    'module',
    'namespace',
    'package',
    'class',
    'method',
    'property',
    'field',
    'constructor',
    'enum',
    'interface',
    'function',
    'variable',
    'constant',
    'string',
    'number',
    'boolean',
    'array',
    'object',
    'key',
    'null',
    'enum member',
    'struct',
    'event',
    'operator',
    'type parameter'
];
const SEVERITIES = ['', 'error', 'warning', 'info', 'hint'];
function parseArgs(raw) {
    const operation = OPERATIONS.find((name) => name === raw.operation);
    if (!operation) {
        return `operation must be one of: ${OPERATIONS.join(', ')}`;
    }
    if (typeof raw.path !== 'string' || !raw.path) {
        return 'path must name a source file';
    }
    const args = {
        operation,
        path: raw.path,
        line: Number(raw.line),
        symbol: typeof raw.symbol === 'string' ? raw.symbol.trim() : '',
        query: typeof raw.query === 'string' ? raw.query.trim() : ''
    };
    const positioned = operation === 'definition' || operation === 'references' || operation === 'hover';
    if (positioned && (!Number.isInteger(args.line) || args.line < 1 || !args.symbol)) {
        return `${operation} needs line (1-based) and the symbol on that line`;
    }
    return args;
}
function wordAt(text, line, symbol) {
    const lines = text.split('\n');
    const content = lines[line - 1];
    if (content === undefined) {
        return { error: `the file has ${lines.length} lines, not ${line}` };
    }
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`).exec(content);
    if (!match) {
        return {
            error: `'${symbol}' is not on line ${line}: ${content.trim().slice(0, MAX_LINE_CHARS)}`
        };
    }
    return { line: line - 1, character: match.index };
}
function serverFor(servers, file) {
    const ext = path.extname(file).toLowerCase();
    const server = servers.find((s) => s.extensions.some((e) => e.toLowerCase() === ext));
    if (server) {
        return server;
    }
    const known = servers.map((s) => `${s.language} (${s.extensions.join(', ')})`).join('; ');
    return `no language server for ${ext ? `${ext} files` : 'a file with no extension'}; configured: ${known}`;
}
function range(value) {
    const start = isRecord(value) && isRecord(value.start) ? value.start : null;
    if (!start || typeof start.line !== 'number' || typeof start.character !== 'number') {
        return null;
    }
    return { line: start.line, character: start.character };
}
function spotOf(uri, at) {
    const start = range(at);
    if (typeof uri !== 'string' || !uri.startsWith('file:') || !start) {
        return null;
    }
    return { file: fileURLToPath(uri), ...start };
}
function spotsOf(result) {
    const items = Array.isArray(result) ? result : [result];
    return items.flatMap((item) => {
        if (!isRecord(item))
            return [];
        const spot = 'targetUri' in item
            ? spotOf(item.targetUri, item.targetSelectionRange ?? item.targetRange)
            : spotOf(item.uri, item.range);
        return spot ? [spot] : [];
    });
}
async function readLines(file) {
    try {
        return (await fs.promises.readFile(file, 'utf8')).split('\n');
    }
    catch {
        return null;
    }
}
async function place(view, spot) {
    const resolved = await resolveKey(spot.file, view.roots, view);
    if ('error' in resolved || resolved.root.kind !== 'local') {
        return { label: spot.file, text: '' };
    }
    const label = path.relative(resolved.root.root, spot.file).split(path.sep).join('/');
    const lines = view.lines.get(spot.file) ?? readLines(spot.file);
    view.lines.set(spot.file, lines);
    const text = (await lines)?.[spot.line]?.trim().slice(0, MAX_LINE_CHARS) ?? '';
    return { label: label || spot.file, text };
}
async function denied(view, file) {
    if (!file || view.deny.length === 0)
        return false;
    const canonical = await view.realpath(file).catch(() => file);
    return isDeniedPath(canonical, view.deny);
}
async function shown(view, items, fileOf) {
    const hidden = await Promise.all(items.map((item) => denied(view, fileOf(item))));
    return items.filter((_item, i) => !hidden[i]);
}
async function renderSpots(view, found, none) {
    const spots = await shown(view, found, (spot) => spot.file);
    if (spots.length === 0) {
        return none;
    }
    const rows = await Promise.all(spots.slice(0, MAX_LOCATIONS).map(async (spot) => {
        const { label, text } = await place(view, spot);
        return `${label}:${spot.line + 1}${text ? `: ${text}` : ''}`;
    }));
    return withMore(rows, spots.length);
}
function withMore(rows, total) {
    return total > rows.length ? `${rows.join('\n')}\n+${total - rows.length} more` : rows.join('\n');
}
function hoverText(result) {
    const contents = isRecord(result) ? result.contents : null;
    const parts = Array.isArray(contents) ? contents : [contents];
    const text = parts.map(markedText).join('\n').trim();
    if (!text) {
        return 'no hover information here';
    }
    return text.length > MAX_HOVER_CHARS ? `${text.slice(0, MAX_HOVER_CHARS)}…` : text;
}
function markedText(part) {
    if (typeof part === 'string') {
        return part;
    }
    return isRecord(part) ? String(part.value ?? '') : '';
}
function kindName(kind) {
    return (typeof kind === 'number' && SYMBOL_KINDS[kind - 1]) || 'symbol';
}
function outline(items, depth = 0, rows = []) {
    for (const item of Array.isArray(items) ? items : []) {
        if (!isRecord(item))
            continue;
        const at = range(item.selectionRange ?? item.range ?? (isRecord(item.location) && item.location.range));
        rows.push(`${'  '.repeat(depth)}${kindName(item.kind)} ${String(item.name)}${at ? ` :${at.line + 1}` : ''}`);
        outline(item.children, depth + 1, rows);
    }
    return rows;
}
function symbolSpot(item) {
    const location = isRecord(item.location) ? item.location : {};
    return spotOf(location.uri, location.range);
}
async function workspaceSymbols(view, result) {
    const listed = (Array.isArray(result) ? result : []).filter(isRecord);
    const items = await shown(view, listed, (item) => symbolSpot(item)?.file ?? null);
    if (items.length === 0) {
        return 'no matching symbols';
    }
    const rows = await Promise.all(items.slice(0, MAX_LOCATIONS).map(async (item) => {
        const spot = symbolSpot(item);
        const where = spot ? await place(view, spot) : null;
        const at = where && spot ? ` ${where.label}:${spot.line + 1}` : '';
        return `${kindName(item.kind)} ${String(item.name)}${at}`;
    }));
    return withMore(rows, items.length);
}
function diagnosticRows(label, items) {
    const list = (Array.isArray(items) ? items : []).filter(isRecord);
    if (list.length === 0) {
        return `${label}: no diagnostics`;
    }
    const rows = list.slice(0, MAX_DIAGNOSTICS).map((item) => {
        const at = range(item.range) ?? { line: 0, character: 0 };
        const severity = (typeof item.severity === 'number' && SEVERITIES[item.severity]) || 'error';
        const code = item.code === undefined ? '' : ` ${String(item.code)}`;
        const message = String(item.message ?? '').replace(/\s*\n\s*/g, ' ');
        return `${label}:${at.line + 1}:${at.character + 1} ${severity}${code} ${message}`;
    });
    return withMore(rows, list.length);
}
async function diagnostics(query) {
    const { server, uri, text, label, call } = query;
    if (server.capabilities.diagnosticProvider) {
        const report = await server.withDocument(uri, text, () => server.request('textDocument/diagnostic', { textDocument: { uri } }, call));
        return diagnosticRows(label, isRecord(report) ? report.items : []);
    }
    const pushed = server.nextDiagnostics(uri, call.timeoutMs, call.signal);
    const items = await server.withDocument(uri, text, () => pushed);
    if (items === null) {
        return { error: `the ${server.config.language} server sent no diagnostics in time` };
    }
    return diagnosticRows(label, items);
}
async function symbols(args, query) {
    const { server, uri, text, view, call } = query;
    if (args.query) {
        const found = await server.withDocument(uri, text, () => server.request('workspace/symbol', { query: args.query }, call));
        return workspaceSymbols(view, found);
    }
    const listed = await server.withDocument(uri, text, () => server.request('textDocument/documentSymbol', { textDocument: { uri } }, call));
    const rows = outline(listed);
    return rows.length ? withMore(rows.slice(0, MAX_OUTLINE), rows.length) : 'no symbols in this file';
}
const POSITIONED = {
    hover: { method: 'textDocument/hover', none: '' },
    definition: { method: 'textDocument/definition', none: 'no definition found' },
    references: { method: 'textDocument/references', none: 'no references found' }
};
async function positioned(args, query) {
    const { server, uri, text, view, call } = query;
    const position = wordAt(text, args.line, args.symbol);
    if ('error' in position) {
        return position;
    }
    const { method, none } = POSITIONED[args.operation];
    const at = { textDocument: { uri }, position };
    const params = args.operation === 'references' ? { ...at, context: { includeDeclaration: true } } : at;
    if (args.operation === 'hover') {
        return server.withDocument(uri, text, async () => {
            const hover = await server.request(method, params, call);
            return (await fromDenied(query, at)) ? { error: PROTECTED_PATH_ERROR } : hoverText(hover);
        });
    }
    const result = await server.withDocument(uri, text, () => server.request(method, params, call));
    return renderSpots(view, spotsOf(result), none);
}
async function fromDenied(query, at) {
    const { server, view, call } = query;
    if (view.deny.length === 0) {
        return false;
    }
    const spots = spotsOf(await server.request('textDocument/definition', at, call));
    const visible = await shown(view, spots, (spot) => spot.file);
    return visible.length < spots.length;
}
function answer(args, query) {
    const { operation } = args;
    if (operation === 'diagnostics') {
        return diagnostics(query);
    }
    if (operation === 'symbols') {
        return symbols(args, query);
    }
    return positioned({ ...args, operation }, query);
}
async function target(args, view, servers) {
    const resolved = await resolveKey(args.path, view.roots, view);
    if ('error' in resolved) {
        return resolved;
    }
    if (resolved.root.kind !== 'local') {
        return { error: 'lsp reads files in local folders only' };
    }
    const file = hostPath(resolved.root, resolved.key);
    const server = serverFor(servers, file);
    if (typeof server === 'string') {
        return { error: server };
    }
    if (!resolved.exists) {
        return { error: `no such file: ${args.path}` };
    }
    return { root: resolved.root, file, server };
}
const DESCRIPTION = 'Ask the language server about code in the granted folders. definition: where a symbol is ' +
    'declared. references: every use of it. hover: its type and docs. symbols: the outline of ' +
    'a file, or with query a search of the whole project. diagnostics: the errors in a file. ' +
    'Name a position by its 1-based line and the symbol on that line.';
const PARAMETERS = {
    type: 'object',
    properties: {
        operation: { type: 'string', enum: [...OPERATIONS], description: 'What to ask' },
        path: {
            type: 'string',
            description: 'The source file; for a project symbol search, any file of the project'
        },
        line: {
            type: 'integer',
            description: 'definition, references, hover: the 1-based line holding the symbol'
        },
        symbol: {
            type: 'string',
            description: 'definition, references, hover: the identifier on that line'
        },
        query: { type: 'string', description: 'symbols: a name to search the project for' }
    },
    required: ['operation', 'path']
};
async function run(args, ctx, options) {
    const { pool, servers, requestTimeoutMs, deniedRoots, realpath = defaultRealpath } = options;
    const deny = await callDenyRoots(deniedRoots, ctx?.policy, realpath);
    const view = { roots: ctx?.fsRoots ?? [], deny, realpath, lines: new Map() };
    const found = await target(args, view, servers);
    if ('error' in found) {
        return found;
    }
    const text = await fs.promises.readFile(found.file, 'utf8');
    const label = path.relative(found.root.root, found.file).split(path.sep).join('/');
    const call = { signal: ctx?.signal, timeoutMs: requestTimeoutMs };
    const uri = pathToFileURL(found.file).href;
    const at = { config: found.server, root: found.root.root, signal: ctx?.signal };
    return pool.use(at, (server) => answer(args, { server, uri, text, label, view, call }));
}
export function createLspTool(options) {
    return {
        name: 'lsp',
        toolset: 'files',
        description: DESCRIPTION,
        parameters: PARAMETERS,
        effect: () => 'read',
        autoApprove: true,
        rootsRequired: true,
        validate(raw) {
            const args = parseArgs(raw);
            return typeof args === 'string' ? args : null;
        },
        async execute(raw, ctx) {
            const args = parseArgs(raw);
            if (typeof args === 'string') {
                return { error: args };
            }
            try {
                const result = await run(args, ctx, options);
                return typeof result === 'string' ? { result } : result;
            }
            catch (error) {
                if (ctx?.signal?.aborted) {
                    throw error;
                }
                return { error: errorMessage(error) };
            }
        }
    };
}
