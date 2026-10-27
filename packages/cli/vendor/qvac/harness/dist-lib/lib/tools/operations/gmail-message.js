import b4a from 'b4a';
import { z } from 'zod';
const AddressList = z.union([z.string(), z.array(z.string())]);
export const GmailEnvelopeSchema = z
    .object({
    to: AddressList,
    cc: AddressList.optional(),
    bcc: AddressList.optional(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
    from: z.string().optional(),
    replyTo: z.string().optional(),
    inReplyTo: z.string().optional(),
    references: z.string().optional()
})
    .refine((value) => !!value.text?.length || !!value.html?.length);
export function buildGmailMessage(envelope) {
    return [...headerLines(envelope), ...bodyLines(envelope)].join('\r\n');
}
function stripNewlines(value) {
    return value.replace(/[\r\n]+/g, ' ');
}
function joinAddresses(value) {
    if (value === undefined)
        return undefined;
    const parts = (Array.isArray(value) ? value : [value])
        .map((entry) => stripNewlines(String(entry)).trim())
        .filter((entry) => entry.length > 0);
    return parts.length > 0 ? parts.join(', ') : undefined;
}
function encodeHeaderValue(value) {
    const sanitized = stripNewlines(value);
    if (/^[\x20-\x7e]*$/.test(sanitized)) {
        return sanitized;
    }
    return `=?UTF-8?B?${b4a.toString(b4a.from(sanitized, 'utf8'), 'base64')}?=`;
}
function headerLines(envelope) {
    const headers = [
        ['To', joinAddresses(envelope.to)],
        ['Cc', joinAddresses(envelope.cc)],
        ['Bcc', joinAddresses(envelope.bcc)],
        ['From', envelope.from],
        ['Reply-To', envelope.replyTo],
        ['Subject', encodeHeaderValue(envelope.subject)],
        ['In-Reply-To', envelope.inReplyTo],
        ['References', envelope.references]
    ];
    return headers
        .filter((entry) => entry[1] !== undefined)
        .map(([name, value]) => `${name}: ${stripNewlines(value)}`);
}
function bodyLines(envelope) {
    const useHtml = !envelope.text && Boolean(envelope.html);
    const content = (useHtml ? envelope.html : envelope.text) ?? '';
    return [
        `Content-Type: ${useHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`,
        'MIME-Version: 1.0',
        '',
        content
    ];
}
