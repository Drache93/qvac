import b4a from 'b4a';
import { stageInputs } from '../attachments/staging.js';
import { WHERE_IDS_ARE } from './request.js';
const IMAGE_REF = /!\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const LINKED = /^(?:data:|https?:)/i;
const LOOKS_LIKE_ID = /^[0-9a-f]{6,}$/i;
const FIRST_HEADING = /^#{1,6}\s.*$/m;
function mimeOf(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return 'image/png';
    }
    return bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : null;
}
function notAnImage(id, bytes) {
    const name = id ?? 'the uploaded file';
    if (b4a.toString(bytes.subarray(0, 5), 'latin1') === '%PDF-') {
        return `${name} is a PDF, not an image; create makes a new PDF from markdown, so read that PDF and write its content into the markdown`;
    }
    return `${name} is not a PNG or JPEG image`;
}
function withIds(markdown, ids) {
    const missing = ids.filter((id) => !markdown.includes(`](${id})`));
    if (!missing.length) {
        return markdown;
    }
    const images = missing.map((id) => `![](${id})`).join('\n\n');
    const heading = FIRST_HEADING.exec(markdown);
    if (!heading) {
        return `${images}\n\n${markdown}`;
    }
    const end = heading.index + heading[0].length;
    return `${markdown.slice(0, end)}\n\n${images}\n\n${markdown.slice(end).replace(/^\n+/, '')}`;
}
async function refOf(alt, target, ctx) {
    const id = target.replace(/^attachment(?:Id)?:/i, '');
    const found = await ctx.fetchAttachment?.({ attachmentId: id, meta: true, signal: ctx.signal });
    if (found) {
        return { alt, attachmentId: id };
    }
    if (LOOKS_LIKE_ID.test(id)) {
        return {
            error: `image ${id} not found in this chat; ${WHERE_IDS_ARE}, or name the user's uploaded image by its file name`
        };
    }
    return { alt, attachmentId: undefined };
}
async function stage(refs, ctx) {
    if (!ctx.fetchAttachment) {
        return { error: 'this device cannot read chat images' };
    }
    return stageInputs(ctx.fetchAttachment, refs.map((ref, i) => ({ attachmentId: ref.attachmentId, path: `image-${i}.png` })), { turnImages: ctx.turnImages, signal: ctx.signal });
}
export async function placeImages(request, ctx) {
    const markdown = withIds(request.markdown, request.ids);
    const matches = [...markdown.matchAll(IMAGE_REF)].filter((match) => !LINKED.test(match[2] ?? ''));
    if (!matches.length) {
        return { ...request, markdown, ids: [] };
    }
    const refs = [];
    for (const match of matches) {
        const ref = await refOf(match[1] ?? '', match[2] ?? '', ctx);
        if ('error' in ref) {
            return ref;
        }
        refs.push(ref);
    }
    const staged = await stage(refs, ctx);
    if ('error' in staged) {
        return staged;
    }
    const uris = [];
    for (const [i, file] of staged.files.entries()) {
        const mime = mimeOf(file.bytes);
        if (!mime) {
            return { error: notAnImage(refs[i]?.attachmentId, file.bytes) };
        }
        uris.push(`data:${mime};base64,${b4a.toString(file.bytes, 'base64')}`);
    }
    let n = 0;
    const placed = markdown.replace(IMAGE_REF, (whole, alt, target) => LINKED.test(target) ? whole : `\n\n![${alt}](${uris[n++] ?? target})\n\n`);
    return { ...request, markdown: placed, ids: [] };
}
