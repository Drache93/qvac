import b4a from 'b4a';
import { z } from 'zod';
import { extractPageText } from '../../web-fetch/extract.js';
import { decodeHtmlEntities } from '../../helpers/html-helpers.js';
import { ELISION } from '../http-request/truncate-response.js';
export const DECODER_NAMES = ['gmail-message'];
const KEPT_HEADERS = ['From', 'To', 'Subject', 'Date', 'Message-ID', 'References'];
const MAX_TEXT_CHARS = 4000;
const PartSchema = z.lazy(() => z.object({
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(PartSchema).optional()
}));
const MessageSchema = z.object({
    id: z.string().optional(),
    threadId: z.string().optional(),
    labelIds: z.array(z.string()).optional(),
    snippet: z.string().optional(),
    payload: PartSchema.optional()
});
const gmailMessage = {
    decode(body) {
        const parsed = MessageSchema.safeParse(body);
        if (!parsed.success) {
            return body;
        }
        const { id, threadId, labelIds, snippet, payload } = parsed.data;
        return {
            id,
            threadId,
            labelIds,
            headers: payload && keptHeaders(payload),
            snippet: snippet && decodeHtmlEntities(snippet),
            text: payload && capped(textOf(payload))
        };
    }
};
function keptHeaders(part) {
    const kept = {};
    for (const header of part.headers ?? []) {
        const name = KEPT_HEADERS.find((known) => known.toLowerCase() === header.name.toLowerCase());
        if (name && !(name in kept)) {
            kept[name] = header.value;
        }
    }
    return kept;
}
function textOf(part) {
    const plain = leaves(part, 'text/plain');
    if (plain.length) {
        return plain.join('\n\n');
    }
    const html = leaves(part, 'text/html')
        .map((leaf) => extractPageText(leaf).text)
        .filter((text) => text.length > 0);
    if (html.length) {
        return html.join('\n\n');
    }
    return undefined;
}
function leaves(part, mimeType) {
    if (part.parts?.length) {
        return part.parts.flatMap((child) => leaves(child, mimeType));
    }
    if (part.mimeType?.toLowerCase() !== mimeType || part.filename || !part.body?.data) {
        return [];
    }
    const text = decodeData(part.body.data);
    return text ? [text] : [];
}
function decodeData(data) {
    try {
        return b4a.toString(b4a.from(data, 'base64url'), 'utf8').replace(/\r\n/g, '\n').trim();
    }
    catch {
        return '';
    }
}
function capped(text) {
    if (text === undefined || text.length <= MAX_TEXT_CHARS)
        return text;
    return `${text.slice(0, MAX_TEXT_CHARS)}${ELISION}`;
}
export const DECODERS = {
    'gmail-message': gmailMessage
};
