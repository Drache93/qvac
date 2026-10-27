import { errorCode, errorMessage } from '../guards.js';
import { checkOutputBytes, RUN_OUTPUT_BUDGET_BYTES } from './attachments/output-policy.js';
import { build, pagesLabel, everyPageShown, readDocs, shownNote, textless } from './pdf/build.js';
import { placeImages } from './pdf/images.js';
import { PAGE_SIZES, parseRequest, PDF_ACTIONS, WHERE_IDS_ARE } from './pdf/request.js';
export { parsePages, parseRequest } from './pdf/request.js';
const SUFFIXES = {
    create: 'revised',
    merge: 'merged',
    split: 'pages',
    rotate: 'rotated',
    watermark: 'watermarked',
    fill: 'filled',
    encrypt: 'locked',
    decrypt: 'unlocked',
    text: 'text',
    read: 'copy'
};
const attachedThisTurn = new WeakMap();
let loaded = null;
function loadPdfium() {
    loaded ??= import('bare-pdfium').then((pdfium) => pdfium, () => null);
    return loaded;
}
function stemOf(fileName) {
    const base = fileName.replace(/^.*[\\/]/, '');
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}
function slug(markdown) {
    const heading = /^#{1,6}\s+(.+)$/m.exec(markdown)?.[1] ?? '';
    const name = heading
        .toLowerCase()
        .replace(/[*_`[\]]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return name || 'document';
}
function extensionOf(request) {
    return request.action === 'text' ? 'txt' : 'pdf';
}
function defaultName(request, first) {
    if (!first) {
        return `${request.action === 'create' ? slug(request.markdown) : 'document'}.pdf`;
    }
    if (request.action === 'text') {
        return `${stemOf(first.fileName)}.txt`;
    }
    return `${stemOf(first.fileName)}_${SUFFIXES[request.action]}.pdf`;
}
export function outputName(request, inputs) {
    const extension = extensionOf(request);
    const { output } = request;
    let wanted = defaultName(request, inputs[0]);
    if (output && /\.[a-z0-9]{2,4}$/i.test(output)) {
        wanted = output.replace(/\.pdf$/i, `.${extension}`);
    }
    else if (output) {
        wanted = `${output}.${extension}`;
    }
    const taken = inputs.some((input) => input.fileName.toLowerCase() === wanted.toLowerCase());
    return taken ? `${stemOf(wanted)}_${SUFFIXES[request.action]}.${extension}` : wanted;
}
async function fetchSources(ids, ctx) {
    if (!ctx.fetchAttachment) {
        return { error: 'this device cannot read chat attachments' };
    }
    const sources = [];
    for (const attachmentId of ids) {
        const found = await ctx.fetchAttachment({ attachmentId, signal: ctx.signal });
        if (!found || !('bytes' in found)) {
            return { error: `attachment ${attachmentId} not found in this chat; ${WHERE_IDS_ARE}` };
        }
        sources.push({ attachmentId, fileName: found.fileName, bytes: found.bytes });
    }
    return sources;
}
function openError(err, source, password) {
    const code = errorCode(err);
    if (code === 'PASSWORD' && password) {
        return `the password is wrong for ${source.fileName}; ask the user for the right one, never guess`;
    }
    if (code === 'PASSWORD') {
        return `${source.fileName} is locked; ask the user for its password and pass it as password`;
    }
    if (code === 'FORMAT' || code === 'FILE') {
        return `${source.fileName} is not a PDF that opens`;
    }
    return `${source.fileName}: ${errorMessage(err)}`;
}
function openAll(pdfium, sources, request) {
    const password = request.action === 'encrypt' ? undefined : request.password;
    const opened = [];
    for (const source of sources) {
        try {
            opened.push({ source, doc: pdfium.open(source.bytes, { password }) });
        }
        catch (err) {
            return { opened, error: openError(err, source, password) };
        }
    }
    return { opened, error: null };
}
async function attachOutput(fileName, bytes, ctx) {
    if (!ctx.attach) {
        return { error: 'this device cannot attach a file to the chat' };
    }
    const delivered = attachedThisTurn.get(ctx.attach) ?? new Map();
    const earlier = delivered.get(fileName.toLowerCase());
    if (earlier) {
        return { attachment: earlier, repeated: true };
    }
    const verdict = checkOutputBytes(fileName, bytes, 0);
    if ('error' in verdict) {
        return verdict;
    }
    const budget = ctx.runBudget;
    if (budget && budget.outputBytesUsed + bytes.byteLength > RUN_OUTPUT_BUDGET_BYTES) {
        return { error: 'run output budget exceeded' };
    }
    const record = await ctx.attach({ fileName, mimeType: verdict.mimeType, bytes, raw: true });
    if (budget) {
        budget.outputBytesUsed += bytes.byteLength;
    }
    const attachment = {
        attachmentId: record.id,
        fileName: record.fileName,
        byteLength: record.byteLength
    };
    delivered.set(fileName.toLowerCase(), attachment);
    attachedThisTurn.set(ctx.attach, delivered);
    return { attachment, repeated: false };
}
const UNDRAWABLE = /^('[^']+' \(U\+[0-9A-F]+\)(?:, '[^']+' \(U\+[0-9A-F]+\))*) cannot be drawn by the built-in fonts/;
function buildError(err) {
    const message = errorMessage(err);
    const characters = UNDRAWABLE.exec(message)?.[1];
    if (!characters) {
        return message;
    }
    return (`${characters} cannot be drawn: a PDF made here takes Western European text only. ` +
        'Leave those characters out, or tell the user this text cannot go in a PDF');
}
function buildSafely({ pdfium, request, opened }) {
    try {
        return build(pdfium, request, opened);
    }
    catch (err) {
        return buildError(err);
    }
}
function reply(request, { output, built, delivered }) {
    const { attachment, repeated } = delivered;
    const summary = request.action === 'text'
        ? `text of ${pagesLabel(built.pageCount)}`
        : pagesLabel(built.pageCount);
    const renamed = request.output && output !== request.output
        ? `Saved as ${output}, so the attached file keeps its own name. `
        : '';
    return {
        attachments: [attachment],
        pageCount: built.pageCount,
        reply: `${attachment.fileName} — ${summary}`,
        next: renamed +
            `Done: ${attachment.fileName} ${repeated ? 'was already' : 'is'} attached to the chat and shown to the user. ` +
            'Do not call pdf again for it. Your answer is the reply value alone, word for word.'
    };
}
async function deliver(job, ctx) {
    const { request, opened } = job;
    const output = outputName(request, opened.map((one) => one.source));
    const extension = `.${extensionOf(request)}`;
    if (!output.toLowerCase().endsWith(extension)) {
        return { error: `output must end in ${extension}, got "${output}"` };
    }
    const built = buildSafely(job);
    if (typeof built === 'string') {
        return { error: built };
    }
    const delivered = await attachOutput(output, built.bytes, ctx);
    return 'error' in delivered ? delivered : reply(request, { output, built, delivered });
}
function isLocked(pdfium, source) {
    try {
        pdfium.open(source.bytes).close();
        return false;
    }
    catch (err) {
        return errorCode(err) === 'PASSWORD';
    }
}
function lockOrUnlock(pdfium, request, sources) {
    const [only] = sources;
    const wantsFile = request.output?.toLowerCase().endsWith('.pdf') === true;
    if (request.action !== 'read' || !request.password || !wantsFile || !only || sources.length > 1) {
        return request;
    }
    if (isLocked(pdfium, only)) {
        return { ...request, action: 'decrypt' };
    }
    return { ...request, action: 'encrypt', ownerPassword: undefined, permissions: undefined };
}
function renderedPageName(fileName, page) {
    return `${fileName}.p${page - 1}.jpg`.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-40);
}
function shownPages(ctx) {
    const names = (ctx.turnImages ?? []).map((image) => image.path.split(/[\\/]/).pop()?.slice(33));
    return (fileName, page) => names.includes(renderedPageName(fileName, page));
}
async function run(pdfium, asked, ctx) {
    if (asked.action === 'create') {
        const placed = await placeImages(asked, ctx);
        return 'error' in placed ? placed : deliver({ pdfium, request: placed, opened: [] }, ctx);
    }
    const sources = asked.ids.length ? await fetchSources(asked.ids, ctx) : [];
    if ('error' in sources) {
        return sources;
    }
    const request = lockOrUnlock(pdfium, asked, sources);
    const { opened, error } = openAll(pdfium, sources, request);
    try {
        if (error) {
            return { error };
        }
        if (request.action === 'read') {
            return readDocs(opened, shownPages(ctx));
        }
        const [only] = opened;
        if (request.action === 'text' &&
            only &&
            textless(only) &&
            everyPageShown(only, shownPages(ctx))) {
            return { note: shownNote(only) };
        }
        return await deliver({ pdfium, request, opened }, ctx);
    }
    finally {
        for (const { doc } of opened) {
            doc.close();
        }
    }
}
const DESCRIPTION = 'Create, read or change PDF files. With attachmentId and no action it returns the page ' +
    'count, each page’s text and the form fields (name, type, value, options). An action saves ' +
    'a new file named output and attaches it to the chat: create (markdown, where ' +
    '![caption](attachmentId) on its own line places a chat image and the file name of the ' +
    "user's upload places that upload; optional pageSize, " +
    'landscape, pageNumbers, password), merge (attachmentIds in order), split (pages), rotate ' +
    '(degrees 90, 180 or 270, optional pages), watermark (text, optional opacity, position, ' +
    'pages), fill (values keyed by field name), encrypt (password, optional ownerPassword, ' +
    'permissions), decrypt (password), text (a .txt of the text). Pages count from 1. A locked ' +
    'PDF needs its password on every action. A failing call saves nothing and its error names ' +
    'what exists, so fix the call from it.';
const PARAMETERS = {
    type: 'object',
    properties: {
        action: {
            type: 'string',
            enum: [...PDF_ACTIONS],
            description: 'What to do; leave it out to read the PDF'
        },
        attachmentId: { type: 'string', description: 'The PDF in this chat' },
        attachmentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'merge: the PDFs to join, in order'
        },
        markdown: { type: 'string', description: 'create: the whole document as Markdown' },
        pages: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Page numbers counted from 1'
        },
        degrees: { type: 'integer', description: 'rotate: 90, 180 or 270, clockwise' },
        text: { type: 'string', description: 'watermark: the text to stamp' },
        opacity: { type: 'number', description: 'watermark: 0 to 1' },
        position: { type: 'string', enum: ['over', 'under'], description: 'watermark' },
        values: { type: 'object', description: 'fill: { "field name": value }' },
        password: {
            type: 'string',
            description: 'encrypt: the new password; otherwise the password of a locked PDF'
        },
        ownerPassword: { type: 'string', description: 'encrypt' },
        permissions: { type: 'object', description: 'encrypt: { print, copy, modify, ... }' },
        pageSize: { type: 'string', enum: [...PAGE_SIZES], description: 'create' },
        landscape: { type: 'boolean', description: 'create' },
        pageNumbers: { type: 'boolean', description: 'create' },
        output: { type: 'string', description: 'File name for the saved file' }
    }
};
export function createPdfTool(load = loadPdfium) {
    return {
        name: 'pdf',
        toolset: null,
        skillGated: true,
        ungatedFor: ['tiny', 'low'],
        description: DESCRIPTION,
        parameters: PARAMETERS,
        effect: () => 'read',
        addons: { 'bare-pdfium': load },
        validate(args) {
            const request = parseRequest(args);
            return typeof request === 'string' ? request : null;
        },
        async execute(args, ctx = {}) {
            const request = parseRequest(args);
            if (typeof request === 'string') {
                return { error: request };
            }
            const pdfium = await load();
            if (!pdfium) {
                return { error: 'this device cannot open PDFs' };
            }
            return run(pdfium, request, ctx);
        }
    };
}
