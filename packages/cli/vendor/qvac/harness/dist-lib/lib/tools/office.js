import b4a from 'b4a';
import { HarnessError } from '../errors.js';
import { errorMessage, isRecord } from '../guards.js';
import { DocsError, docx, pptx, units, xlsx } from '../office/engine/index.js';
import { stageInputs } from './attachments/staging.js';
import { checkOutputBytes, RUN_OUTPUT_BUDGET_BYTES } from './attachments/output-policy.js';
import { DOCX_OPS, opArguments, opKeys, PPTX_OPS, withAliases, XLSX_OPS } from './office/ops.js';
const READ_CELL_LIMIT = 10_000;
const attachedThisTurn = new WeakMap();
const FIRST_SHEET = /^sheet ?1$/i;
const NEW_DECK_HINT = '; a new deck has only the slides its addSlide ops make, slides count from 0, and an op on a slide goes after the addSlide that makes it';
const SHAPE_ROLES = new Set(['title', 'subtitle', 'body']);
const HOISTED = ['attachmentId', 'output'];
const BLOCK_POSITIONED = new Set(['insertParagraphs', 'addTable', 'addImage', 'addChart']);
const FILE_NAME = /\.\w+$/;
const WHERE_IDS_ARE = 'copy the id from the [Attached file "…" — attachmentId: …] line or an earlier tool result';
function isObject(value) {
    return isRecord(value) && !Array.isArray(value);
}
export function shapeFor(deck, op) {
    const { shape, slide } = op;
    if (typeof shape !== 'string' || SHAPE_ROLES.has(shape) || typeof slide !== 'number') {
        return op;
    }
    if (/^\d+$/.test(shape)) {
        return { ...op, shape: Number(shape) };
    }
    const wanted = shape.trim().toLowerCase();
    const found = deck.read()[slide]?.shapes.find((entry) => entry.name.toLowerCase() === wanted);
    return found && found.id !== null ? { ...op, shape: found.id } : op;
}
function positionFor(doc, op, created) {
    if (!created || !BLOCK_POSITIONED.has(String(op.op)) || typeof op.at !== 'number') {
        return op;
    }
    return op.at > doc.blockCount ? { ...op, at: doc.blockCount } : op;
}
function newDeckHint(err, created) {
    return created && err instanceof DocsError && err.code === 'SLIDE_NOT_FOUND' ? NEW_DECK_HINT : '';
}
export function sheetFor(book, op, created) {
    if (typeof op.sheet !== 'string')
        return op;
    const sheets = book.sheets();
    if (sheets.some((sheet) => sheet.name === op.sheet)) {
        return op;
    }
    const only = sheets.length === 1 ? sheets[0] : undefined;
    if (!only) {
        return op;
    }
    if (FIRST_SHEET.test(op.sheet)) {
        return { ...op, sheet: only.name };
    }
    if (created && FIRST_SHEET.test(only.name) && book.read(only.index).rows.length === 0) {
        book.renameSheet(only.index, op.sheet);
    }
    return op;
}
function readWorkbook(book) {
    const sheets = book.sheets();
    const read = [];
    let budget = READ_CELL_LIMIT;
    for (const sheet of sheets) {
        if (sheet.kind !== 'worksheet')
            continue;
        if (budget <= 0) {
            read.push({ name: sheet.name, range: sheet.range ?? null, truncated: true });
            continue;
        }
        const contents = book.read(sheet.index, { limit: budget });
        budget -= contents.rows.reduce((cells, row) => cells + row.length, 0);
        read.push(contents);
    }
    return { sheets, read };
}
const PPTX_FORMAT = {
    name: 'pptx',
    noun: 'PowerPoint deck',
    stem: 'presentation',
    ops: PPTX_OPS,
    createKeys: ['size', 'title', 'fonts', 'colors'],
    open: (bytes) => pptx.open(bytes),
    create: (options) => pptx.create(options),
    read: (deck) => deck.read(),
    count: (deck) => ({ slides: deck.slideCount }),
    prepare: (deck, op) => shapeFor(deck, op),
    hint: newDeckHint
};
const DOCX_FORMAT = {
    name: 'docx',
    noun: 'Word document',
    stem: 'document',
    ops: DOCX_OPS,
    createKeys: ['title', 'page', 'size', 'fonts'],
    open: (bytes) => docx.open(bytes),
    create: (options) => docx.create(options),
    read: (doc) => doc.read(),
    count: (doc) => ({ blocks: doc.blockCount }),
    prepare: (doc, op, created) => positionFor(doc, op, created)
};
const XLSX_FORMAT = {
    name: 'xlsx',
    noun: 'Excel workbook',
    stem: 'workbook',
    ops: XLSX_OPS,
    createKeys: ['sheets', 'title'],
    open: (bytes) => xlsx.open(bytes),
    create: (options) => xlsx.create(options),
    read: readWorkbook,
    count: (book) => ({ sheets: book.sheets().length }),
    prepare: (book, op, created) => sheetFor(book, op, created),
    beforeSave: (book) => book.hasMacros
        ? 'the workbook has macros, which cannot be saved as .xlsx — add a removeMacros op'
        : null
};
export function normalizeArgs(args) {
    if (!Array.isArray(args.ops))
        return args;
    const lifted = { ...args };
    const ops = [];
    for (const entry of args.ops) {
        const op = typeof entry === 'string' ? { op: entry } : entry;
        if (!isObject(op)) {
            ops.push(op);
            continue;
        }
        const rest = { ...op };
        for (const key of HOISTED) {
            if (key in rest && lifted[key] === undefined) {
                lifted[key] = rest[key];
                delete rest[key];
            }
        }
        if (rest.op === 'create' && lifted.create === undefined && lifted.attachmentId === undefined) {
            const { op: _create, ...options } = rest;
            lifted.create = options;
            continue;
        }
        if (rest.op === 'output') {
            const { op: _output, ...named } = rest;
            lifted.output ??= Object.values(named).find((value) => typeof value === 'string' && FILE_NAME.test(value));
            continue;
        }
        ops.push(rest);
    }
    lifted.ops = lifted.attachmentId === undefined ? ops.map(insertedWhereAsked) : ops;
    return lifted;
}
function insertedWhereAsked(op) {
    return isObject(op) && op.op === 'appendParagraphs' && op.at !== undefined
        ? { ...op, op: 'insertParagraphs' }
        : op;
}
function parseOp(format, op, i) {
    if (!isObject(op) || typeof op.op !== 'string') {
        return `ops[${i}] must be { op, ...args }`;
    }
    const spec = format.ops[op.op];
    if (!spec) {
        return `ops[${i}]: unknown op "${op.op}"; ops are ${Object.keys(format.ops).join(', ')}`;
    }
    const keys = opKeys(spec);
    const unknown = Object.keys(op).filter((key) => key !== 'op' && !keys.includes(key));
    if (!unknown.length) {
        return { name: op.op, spec, args: withAliases(spec, op) };
    }
    if (op.op === 'sheets' && 'name' in op && format.ops.addSheet) {
        return `ops[${i}] sheets lists the sheets and takes no arguments; to add a sheet use { op: "addSheet", name }`;
    }
    const takes = keys.length ? `it takes ${keys.join(', ')}` : 'it takes no arguments';
    const nested = unknown.filter((key) => format.ops[key]);
    const apart = nested.length
        ? `; ${nested.map((name) => `{ "op": "${name}", ... }`).join(' and ')} goes in ops as its own entry, next to this one, not inside it`
        : '';
    return `ops[${i}] ${op.op} does not take ${unknown.join(', ')}; ${takes}${apart}`;
}
function parseOps(format, ops) {
    if (!Array.isArray(ops)) {
        return 'ops must be an array of { op, ...args }';
    }
    const parsed = [];
    for (const [i, op] of ops.entries()) {
        const result = parseOp(format, op, i);
        if (typeof result === 'string') {
            return result;
        }
        parsed.push(result);
    }
    return parsed;
}
function argumentError(format, args) {
    const { attachmentId, create, output } = args;
    if (attachmentId !== undefined && (typeof attachmentId !== 'string' || !attachmentId)) {
        return 'attachmentId must be a non-empty string';
    }
    if (create !== undefined && !isObject(create)) {
        return 'create must be an object';
    }
    if (attachmentId !== undefined && create !== undefined) {
        return `pass attachmentId to open a ${format.noun}, or create to start one — not both`;
    }
    const unknownCreate = Object.keys(create ?? {}).filter((key) => !format.createKeys.includes(key));
    if (unknownCreate.length) {
        return `create does not take ${unknownCreate.join(', ')}; it takes ${format.createKeys.join(', ')}`;
    }
    if (output !== undefined && (typeof output !== 'string' || !output)) {
        return 'output must be a file name';
    }
    return null;
}
function parseRequest(format, raw) {
    const args = normalizeArgs(raw);
    const error = argumentError(format, args);
    if (error) {
        return error;
    }
    const ops = parseOps(format, args.ops ?? []);
    if (typeof ops === 'string') {
        return ops;
    }
    const attachmentId = typeof args.attachmentId === 'string' ? args.attachmentId : undefined;
    if (attachmentId === undefined && !ops.length) {
        return `nothing to read: pass the attachmentId of a ${format.noun} (${WHERE_IDS_ARE}), or ops to build one`;
    }
    return {
        attachmentId,
        create: isObject(args.create) ? args.create : undefined,
        ops,
        output: typeof args.output === 'string' ? args.output : undefined
    };
}
async function sourceDocument(format, request, ctx) {
    if (request.attachmentId === undefined) {
        return { document: format.create(request.create ?? {}), fileName: null };
    }
    const found = await ctx.fetchAttachment?.({
        attachmentId: request.attachmentId,
        signal: ctx.signal
    });
    if (!found || !('bytes' in found)) {
        return {
            error: `attachment ${request.attachmentId} not found in this chat; ${WHERE_IDS_ARE}, not a file name`
        };
    }
    return { document: format.open(found.bytes), fileName: found.fileName };
}
export function revisedName(format, fileName) {
    const dot = fileName.lastIndexOf('.');
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
    if (format === 'pptx') {
        const version = /^(.*)-v(\d+)$/.exec(stem);
        return version ? `${version[1]}-v${Number(version[2]) + 1}.pptx` : `${stem}-v2.pptx`;
    }
    const revised = /^(.*)_revised(?:-(\d+))?$/.exec(stem);
    if (!revised) {
        return `${stem}_revised.${format}`;
    }
    return `${revised[1]}_revised-${Number(revised[2] ?? 1) + 1}.${format}`;
}
function newFileName(format, title) {
    const stem = typeof title === 'string'
        ? title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48)
        : '';
    return `${stem || format.stem}.${format.name}`;
}
function outputFor(format, { output, create }, input) {
    if (!input) {
        return output ?? newFileName(format, create?.title);
    }
    if (output && output.toLowerCase() !== input.toLowerCase()) {
        return output;
    }
    return revisedName(format.name, input);
}
async function imageId(ctx, id) {
    const found = await ctx.fetchAttachment?.({ attachmentId: id, meta: true, signal: ctx.signal });
    if (found) {
        return id;
    }
    const latest = await ctx.fetchAttachment?.({ meta: true, signal: ctx.signal });
    return latest && latest.fileName.toLowerCase() === id.toLowerCase() ? undefined : id;
}
async function imageInput(op, i, ctx) {
    const image = op.args.image ?? {};
    if (!isObject(image)) {
        return { error: `ops[${i}]: image must be { attachmentId } or {}` };
    }
    const id = image.attachmentId;
    if (id !== undefined && (typeof id !== 'string' || !id)) {
        return { error: `ops[${i}]: image.attachmentId must be a non-empty string` };
    }
    return { attachmentId: id ? await imageId(ctx, id) : undefined, path: `image-${i}.png` };
}
function takesImage(op) {
    return op.spec.slots.includes('image') || op.args.image !== undefined;
}
async function stagedImages(request, ctx) {
    const wanted = request.ops.flatMap((op, i) => (takesImage(op) ? [i] : []));
    const images = new Map();
    if (!wanted.length) {
        return images;
    }
    if (!ctx.fetchAttachment) {
        return { error: 'this device cannot read chat images' };
    }
    const inputs = [];
    for (const i of wanted) {
        const op = request.ops[i];
        const input = op ? await imageInput(op, i, ctx) : { error: `ops[${i}] is missing` };
        if ('error' in input) {
            return input;
        }
        inputs.push(input);
    }
    const staged = await stageInputs(ctx.fetchAttachment, inputs, {
        turnImages: ctx.turnImages,
        signal: ctx.signal
    });
    if ('error' in staged) {
        return staged;
    }
    for (const [n, file] of staged.files.entries()) {
        const at = wanted[n];
        if (at !== undefined) {
            images.set(at, file.bytes);
        }
    }
    return images;
}
function saveError({ format, document, output }, ctx) {
    if (!output.toLowerCase().endsWith(`.${format.name}`)) {
        return `output must end in .${format.name}, got "${output}"`;
    }
    const refusal = format.beforeSave?.(document);
    if (refusal) {
        return refusal;
    }
    return ctx.attach ? null : `this device cannot attach a ${format.noun} to the chat`;
}
async function attachOutput(job, ctx) {
    const refused = saveError(job, ctx);
    if (refused || !ctx.attach) {
        return { error: refused ?? 'nothing to save' };
    }
    const { output, document } = job;
    const delivered = attachedThisTurn.get(ctx.attach) ?? new Map();
    const earlier = delivered.get(output.toLowerCase());
    const bytes = document.save();
    if (earlier && b4a.equals(earlier.bytes, bytes)) {
        return { attachment: earlier.attachment, repeated: true };
    }
    if (earlier) {
        return {
            error: `${earlier.attachment.fileName} is already attached with different content; save this version under a new name in output`
        };
    }
    const verdict = checkOutputBytes(output, bytes, 0);
    if ('error' in verdict) {
        return verdict;
    }
    const budget = ctx.runBudget;
    if (budget && budget.outputBytesUsed + bytes.byteLength > RUN_OUTPUT_BUDGET_BYTES) {
        return { error: 'run output budget exceeded' };
    }
    const record = await ctx.attach({
        fileName: output,
        mimeType: verdict.mimeType,
        bytes,
        raw: true
    });
    if (budget) {
        budget.outputBytesUsed += bytes.byteLength;
    }
    const attachment = {
        attachmentId: record.id,
        fileName: record.fileName,
        byteLength: record.byteLength
    };
    delivered.set(output.toLowerCase(), { attachment, bytes });
    attachedThisTurn.set(ctx.attach, delivered);
    return { attachment, repeated: false };
}
function runOp(document, op, input) {
    const method = Reflect.get(document, op.name);
    if (typeof method !== 'function') {
        throw new HarnessError('OFFICE_OP_UNAVAILABLE', [op.name]);
    }
    return Reflect.apply(method, document, opArguments(op.spec, input, units.inches));
}
function runOps({ format, document, request, images }) {
    const results = [];
    const created = request.attachmentId === undefined;
    for (const [i, op] of request.ops.entries()) {
        const placed = format.prepare?.(document, op.args, created) ?? op.args;
        const input = images.has(i) ? { ...placed, image: images.get(i) } : placed;
        try {
            results.push(runOp(document, op, input));
        }
        catch (err) {
            const hint = format.hint?.(err, created) ?? '';
            return { error: `ops[${i}] ${op.name}: ${errorMessage(err)}${hint}` };
        }
    }
    return results;
}
function countLine(counts) {
    return Object.entries(counts)
        .map(([noun, n]) => `${n} ${n === 1 ? noun.replace(/s$/, '') : noun}`)
        .join(', ');
}
function describe(format) {
    const queries = Object.keys(format.ops).filter((name) => format.ops[name]?.query);
    const edits = Object.keys(format.ops).filter((name) => !format.ops[name]?.query);
    const inches = Object.values(format.ops).some((spec) => spec.inches)
        ? ' Positions and sizes (x, y, width, height) are inches.'
        : '';
    return (`Read, edit or create a ${format.noun} (.${format.name}). With attachmentId alone it ` +
        `returns the ${format.noun}'s contents. ops run office engine methods in order, each ` +
        `{ op, ...named args }: ${queries.join(', ')} return data; ${edits.join(', ')} change the ` +
        'file. When anything changed, the result is saved as a chat attachment named output and ' +
        'shown to the user automatically. A failing op saves nothing and its error names what ' +
        `exists, so fix the call from it.${inches}`);
}
function parameters(format) {
    return {
        type: 'object',
        properties: {
            attachmentId: {
                type: 'string',
                description: `The ${format.noun} in this chat; omit it to create a new one`
            },
            create: {
                type: 'object',
                description: `Options for a new ${format.noun}: ${format.createKeys.join(', ')}`
            },
            ops: {
                type: 'array',
                description: 'Operations to run in order, each { op, ...named args }',
                items: {
                    type: 'object',
                    properties: { op: { type: 'string', enum: Object.keys(format.ops) } },
                    required: ['op']
                }
            },
            output: {
                type: 'string',
                description: `File name for the saved ${format.noun}, ending in .${format.name}`
            }
        }
    };
}
async function execute(format, args, ctx) {
    const request = parseRequest(format, args);
    if (typeof request === 'string') {
        return { error: request };
    }
    if (request.attachmentId !== undefined && !ctx.fetchAttachment) {
        return { error: 'this device cannot read chat attachments' };
    }
    const images = await stagedImages(request, ctx);
    if ('error' in images) {
        return images;
    }
    let source;
    try {
        source = await sourceDocument(format, request, ctx);
    }
    catch (err) {
        return { error: errorMessage(err) };
    }
    if ('error' in source) {
        return source;
    }
    const { document, fileName } = source;
    if (!request.ops.length) {
        return { document: format.read(document) };
    }
    const results = runOps({ format, document, request, images });
    if ('error' in results) {
        return results;
    }
    const onlyQueries = request.ops.every(({ spec }) => spec.query);
    if (onlyQueries || (!document.changed && request.attachmentId !== undefined)) {
        return { results };
    }
    const output = outputFor(format, request, fileName);
    const saved = await attachOutput({ format, document, output }, ctx);
    if ('error' in saved) {
        return saved;
    }
    const { attachment, repeated } = saved;
    const counts = format.count(document);
    const renamed = fileName !== null && output !== request.output
        ? `Saved as ${output}, so the attached ${fileName} keeps its own name. `
        : '';
    const unplaced = !!ctx.turnImages?.length && !images.size;
    return {
        results,
        attachments: [attachment],
        ...counts,
        reply: `${attachment.fileName} — ${countLine(counts)}`,
        next: renamed +
            `Done: ${attachment.fileName} ${repeated ? 'was already' : 'is'} attached to the chat and shown to the user. ` +
            afterSave(format, attachment.attachmentId, unplaced)
    };
}
function afterSave(format, attachmentId, unplaced) {
    const reply = 'Your answer is the reply value alone, word for word.';
    if (!unplaced) {
        return `Do not call ${format.name} again for it. ${reply}`;
    }
    return (`The image the user attached to their message is not in it. If they asked for that image in the ${format.noun}, ` +
        `call ${format.name} once more with attachmentId "${attachmentId}" and one op that adds it with "image": {}. ` +
        `Otherwise: ${reply}`);
}
function createOfficeTool(format) {
    return {
        name: format.name,
        toolset: null,
        skillGated: true,
        description: describe(format),
        parameters: parameters(format),
        effect: () => 'read',
        validate(args) {
            const request = parseRequest(format, args);
            return typeof request === 'string' ? request : null;
        },
        execute: (args, ctx = {}) => execute(format, args, ctx)
    };
}
export function createOfficeTools() {
    return [
        createOfficeTool(PPTX_FORMAT),
        createOfficeTool(DOCX_FORMAT),
        createOfficeTool(XLSX_FORMAT)
    ];
}
