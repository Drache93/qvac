import { noRedirectFetch } from '#no-redirect-fetch';
import { AbortController } from 'bare-abort-controller';
import { lookupHost } from '../dns-lookup.js';
import { errorMessage } from '../guards.js';
import { AbortedError } from '../helpers/race-abort.js';
import { BROWSER_UA } from '../helpers/user-agents.js';
import { extractEmbeddedState } from '../web-fetch/embedded-state.js';
import { extractPageText, looksLikeHtml } from '../web-fetch/extract.js';
import { imageFileName, pageImageUrls } from '../web-fetch/images.js';
import { pageVideoRef } from '../web-fetch/video.js';
import { isRedirectStatus } from './http-request/request.js';
import { Policy } from '../policy/index.js';
import { resolveOutboundUrl } from './url-guard.js';
const SMALL_CONTEXT_TOKENS = 12_288;
const SMALL_CONTEXT_CHARS = 6_000;
const LARGE_CONTEXT_CHARS = 16_000;
const PAGE_TIMEOUT_MS = 15_000;
const SOURCE_EXCERPT_CHARS = 2_000;
const MIN_MARKUP_CHARS = 200;
const MAX_REDIRECTS = 5;
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_PAGE_BYTES = 8_000_000;
const MAX_HTML_CHARS = 2_000_000;
function charBudget(ctxSize) {
    return ctxSize && ctxSize <= SMALL_CONTEXT_TOKENS ? SMALL_CONTEXT_CHARS : LARGE_CONTEXT_CHARS;
}
export function createWebFetchTool({ fetch: fetchImpl, resolveHost = lookupHost } = {}) {
    return {
        name: 'web_fetch',
        toolset: 'web-search',
        description: 'Fetch a public web page and return its readable text. ' +
            'Use this to read the full content behind a web_search result URL, or a page the user ' +
            'shares, when a search snippet is not enough to answer. ' +
            'When the URL serves a file rather than a page — PDF, .docx, .xlsx, .pptx, an image, any ' +
            'binary — this is also the tool that downloads it: the bytes become a chat attachment and ' +
            'the result carries its attachmentId. A plain-text file (.txt, .csv, .json…) is attached ' +
            'too, and its text is also returned. It is the only way to get a remote file into the ' +
            'chat; exec has no network and http_request truncates binary bodies.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Full http:// or https:// URL of the page to read' }
            },
            required: ['url']
        },
        effect: () => 'read',
        egress: (args) => (typeof args.url === 'string' ? args.url : null),
        stableRead: true,
        resource: (args) => {
            try {
                return { kind: 'host', label: new URL(String(args.url)).hostname };
            }
            catch {
                return null;
            }
        },
        async execute(args, ctx) {
            const raw = args.url;
            if (typeof raw !== 'string' || raw.trim().length === 0) {
                return { error: 'url must be a non-empty string' };
            }
            let url;
            try {
                url = new URL(raw.trim());
            }
            catch {
                return { error: `"${raw}" is not a valid URL` };
            }
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return { error: `Scheme "${url.protocol}" not allowed. Use http: or https:.` };
            }
            if (ctx?.signal?.aborted) {
                return { error: 'web_fetch cancelled' };
            }
            const fetch = fetchImpl ?? noRedirectFetch;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(undefined), PAGE_TIMEOUT_MS);
            const onCallerAbort = () => controller.abort(undefined);
            ctx?.signal?.addEventListener('abort', onCallerAbort);
            const hosts = Policy.hostsOf(ctx?.policy);
            try {
                const got = await guardedGet(fetch, url, {
                    resolveHost,
                    hosts,
                    signal: controller.signal,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    maxBytes: MAX_PAGE_BYTES,
                    truncate: true
                });
                if (!got.ok) {
                    return { error: got.error };
                }
                const { response, finalUrl: currentUrl } = got;
                if (response.status < 200 || response.status >= 300) {
                    return {
                        error: `HTTP ${response.status} fetching ${currentUrl.toString()}`,
                        status: response.status
                    };
                }
                const rawBody = await response.text();
                const body = rawBody.length > MAX_HTML_CHARS ? rawBody.slice(0, MAX_HTML_CHARS) : rawBody;
                let mimeType = response.headers?.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
                if (body.startsWith('%PDF-')) {
                    mimeType = 'application/pdf';
                }
                if (isBinaryMime(mimeType) || body.includes('\u0000')) {
                    const attachMime = isBinaryMime(mimeType) ? mimeType : 'application/octet-stream';
                    return await attachDocument(response, {
                        url: currentUrl,
                        mimeType: attachMime,
                        attach: ctx?.attach
                    });
                }
                const isHtml = looksLikeHtml(body);
                let page = isHtml ? extractPageText(body) : { title: null, text: body.trim() };
                if (isHtml && page.text.length < MIN_MARKUP_CHARS) {
                    const embedded = extractEmbeddedState(body);
                    if (embedded.length > page.text.length) {
                        page = { title: page.title, text: embedded };
                    }
                }
                const budget = charBudget(ctx?.ctxSize);
                const text = page.text.length > budget ? `${page.text.slice(0, budget)}…[truncated]` : page.text;
                if (text.length === 0) {
                    return {
                        content: isHtml
                            ? `No readable text found at ${url.toString()} — the page likely requires JavaScript to render.`
                            : `The response at ${url.toString()} is empty.`
                    };
                }
                const attached = isHtml
                    ? await attachPageImages(body, currentUrl, {
                        fetch,
                        resolveHost,
                        hosts,
                        attach: ctx?.attach,
                        signal: controller.signal
                    })
                    : [];
                const imagesLine = attached.length
                    ? `\n\n[Attached ${attached.length === 1 ? 'image' : 'images'}: ${attached.join(', ')} — shown to the user automatically]`
                    : '';
                const file = isHtml
                    ? null
                    : await attachTextFile(response, { url: currentUrl, mimeType, attach: ctx?.attach });
                const fileLine = file
                    ? `\n\n[Attached the file "${file.fileName}" (${Math.round(file.byteLength / 1024)}KB) — the user can open or save it; stage it with exec as inputs [{ "attachmentId": "${file.id}", "path": "${file.fileName}" }] to read past the text above]`
                    : '';
                const video = isHtml ? pageVideoRef(body, currentUrl) : null;
                const videoLine = video
                    ? `\n\n[This page's video: ${video.url} — share this link when the user wants to watch it]`
                    : '';
                const header = page.title ? `${page.title}\nSource: ${url}` : `Source: ${url}`;
                return {
                    attachmentId: file?.id,
                    fileName: file?.fileName,
                    byteLength: file?.byteLength,
                    content: `${header}\n\n${text}${fileLine}${imagesLine}${videoLine}`,
                    data: {
                        results: [
                            {
                                title: page.title ?? url.toString(),
                                url: url.toString(),
                                content: text.slice(0, SOURCE_EXCERPT_CHARS)
                            }
                        ]
                    }
                };
            }
            catch (err) {
                if (ctx?.signal?.aborted || err instanceof AbortedError) {
                    return { error: 'web_fetch cancelled' };
                }
                if (controller.signal.aborted) {
                    return { error: `${url.hostname} timed out after ${PAGE_TIMEOUT_MS}ms`, code: 'timeout' };
                }
                return { error: errorMessage(err), code: 'transport' };
            }
            finally {
                clearTimeout(timeout);
                ctx?.signal?.removeEventListener('abort', onCallerAbort);
            }
        }
    };
}
const BINARY_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'font/', 'model/'];
function isBinaryMime(mimeType) {
    if (mimeType in MIME_EXTENSIONS)
        return true;
    return BINARY_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}
async function attachDocument(response, { url, mimeType, attach }) {
    const bytes = await response.bytes?.();
    if (!attach || !bytes || bytes.byteLength === 0) {
        return { error: 'This URL serves a file, not a readable page, and it could not be attached.' };
    }
    if (bytes.byteLength >= MAX_PAGE_BYTES) {
        return {
            error: `This file is larger than ${MAX_PAGE_BYTES / 1_000_000}MB and was not attached.`
        };
    }
    const mime = mimeType || 'application/octet-stream';
    const record = await attach({
        fileName: attachmentFileName(url, mime),
        mimeType: mime,
        bytes,
        raw: !mime.startsWith('image/')
    });
    return {
        attachmentId: record.id,
        fileName: record.fileName,
        byteLength: record.byteLength,
        content: `Attached the file "${record.fileName}" (${Math.round(record.byteLength / 1024)}KB, ${mime}) from ${url.toString()} — ` +
            'the user can open or save it. Its contents were NOT read, so do not describe what is inside ' +
            'yet. To read it, stage it with exec as ' +
            `inputs [{ "attachmentId": "${record.id}", "path": "${record.fileName}" }] — never ask the ` +
            'user to attach a file this call already attached.'
    };
}
async function attachTextFile(response, { url, mimeType, attach }) {
    if (!attach)
        return null;
    const bytes = await response.bytes?.();
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength >= MAX_PAGE_BYTES) {
        return null;
    }
    const mime = mimeType || 'text/plain';
    try {
        return await attach({
            fileName: attachmentFileName(url, mime),
            mimeType: mime,
            bytes,
            raw: true
        });
    }
    catch {
        return null;
    }
}
const TEXT_EXTENSIONS = {
    'text/plain': 'txt',
    'text/markdown': 'md'
};
const MIME_EXTENSIONS = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/epub+zip': 'epub',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'image/svg+xml': 'svg',
    'image/jpeg': 'jpg',
    'audio/mpeg': 'mp3',
    'application/octet-stream': 'bin'
};
function attachmentFileName(url, mimeType) {
    const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
    let decoded = last;
    try {
        decoded = decodeURIComponent(last);
    }
    catch { }
    const base = decoded.split(/[/\\]/).filter(Boolean).pop() ?? '';
    if (!base) {
        return `${url.hostname}.${extensionFor(mimeType)}`;
    }
    const extension = /\.([\w-]{1,8})$/.exec(base)?.[1]?.toLowerCase() ?? '';
    if (extension && acceptableExtensions(mimeType).has(extension)) {
        return base;
    }
    const trustsUrl = mimeType === 'application/octet-stream' || !isBinaryMime(mimeType);
    if (trustsUrl && /^[a-z][\w-]*$/.test(extension)) {
        return base;
    }
    return `${base}.${extensionFor(mimeType)}`;
}
function acceptableExtensions(mimeType) {
    const accepted = new Set([extensionFor(mimeType)]);
    const subtype = mimeType.split('/')[1] ?? '';
    if (/^[a-z0-9]{1,8}$/.test(subtype)) {
        accepted.add(subtype);
    }
    return accepted;
}
function extensionFor(mimeType) {
    const known = MIME_EXTENSIONS[mimeType] ?? TEXT_EXTENSIONS[mimeType];
    if (known) {
        return known;
    }
    const subtype = mimeType.split('/')[1] ?? '';
    return /^[a-z0-9]{1,5}$/.test(subtype) ? subtype : 'bin';
}
async function guardedGet(fetch, url, { resolveHost, hosts, signal, accept, maxBytes, truncate }) {
    const initialCheck = await resolveOutboundUrl(url, { resolveHost, signal, hosts });
    if (initialCheck.blocked) {
        return { ok: false, error: initialCheck.blocked };
    }
    let currentUrl = url;
    let validatedAddresses = initialCheck.addresses;
    for (let redirects = 0;; redirects++) {
        const response = await fetch(currentUrl, {
            method: 'GET',
            headers: { 'User-Agent': BROWSER_UA, Accept: accept },
            signal,
            redirect: 'manual',
            validatedAddresses,
            maxBytes,
            truncate
        });
        if (!isRedirectStatus(response.status)) {
            return { ok: true, response, finalUrl: currentUrl };
        }
        const location = response.headers?.get('location');
        if (!location) {
            return { ok: true, response, finalUrl: currentUrl };
        }
        let nextUrl;
        try {
            nextUrl = new URL(location, currentUrl);
        }
        catch {
            return { ok: true, response, finalUrl: currentUrl };
        }
        if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
            return { ok: true, response, finalUrl: currentUrl };
        }
        if (redirects >= MAX_REDIRECTS) {
            return { ok: false, error: 'too many redirects' };
        }
        const hopCheck = await resolveOutboundUrl(nextUrl, { resolveHost, signal, hosts });
        if (hopCheck.blocked) {
            return { ok: false, error: hopCheck.blocked };
        }
        currentUrl = nextUrl;
        validatedAddresses = hopCheck.addresses;
    }
}
async function attachPageImages(html, pageUrl, { fetch, resolveHost, hosts, attach, signal }) {
    if (!attach)
        return [];
    const attached = [];
    for (const href of pageImageUrls(html, pageUrl)) {
        try {
            const got = await guardedGet(fetch, new URL(href), {
                resolveHost,
                hosts,
                signal,
                accept: 'image/*',
                maxBytes: MAX_IMAGE_BYTES
            });
            if (!got.ok) {
                continue;
            }
            const { response, finalUrl } = got;
            if (response.status < 200 || response.status >= 300) {
                continue;
            }
            const mimeType = response.headers?.get('content-type')?.split(';')[0]?.trim() ?? '';
            if (!mimeType.startsWith('image/')) {
                continue;
            }
            const bytes = await response.bytes?.();
            if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
                continue;
            }
            const record = await attach({ fileName: imageFileName(finalUrl, mimeType), mimeType, bytes });
            attached.push(record.fileName);
        }
        catch {
            continue;
        }
    }
    return attached;
}
