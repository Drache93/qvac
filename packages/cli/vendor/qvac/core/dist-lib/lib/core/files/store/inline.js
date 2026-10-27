import b4a from 'b4a';
export const MAX_INLINE_BYTES = 512 * 1024;
export const MAX_REFERENCE_CHARS = 4 * Math.ceil(MAX_INLINE_BYTES / 3) + 1024;
export function inlineReference(bytes, mimeType) {
    if (bytes.length > MAX_INLINE_BYTES) {
        throw new Error('inline output exceeds 512 KiB');
    }
    return JSON.stringify({
        blockOffset: 0,
        blockLength: 0,
        byteOffset: 0,
        byteLength: 0,
        inline: { mimeType, data: b4a.toString(bytes, 'base64') }
    });
}
export function readInline(record) {
    if (record.inline === undefined)
        return;
    const inline = record.inline;
    if (!inline ||
        typeof inline !== 'object' ||
        !('mimeType' in inline) ||
        typeof inline.mimeType !== 'string' ||
        inline.mimeType.length > 100 ||
        !inline.mimeType.includes('/') ||
        !('data' in inline) ||
        typeof inline.data !== 'string' ||
        record.coreKey !== undefined ||
        [record.blockOffset, record.blockLength, record.byteOffset, record.byteLength].some((offset) => offset !== 0)) {
        throw new TypeError('invalid inline output');
    }
    const { data, mimeType } = inline;
    const bytes = b4a.from(data, 'base64');
    if (bytes.length > MAX_INLINE_BYTES) {
        throw new Error('inline output exceeds 512 KiB');
    }
    if (b4a.toString(bytes, 'base64') !== data) {
        throw new TypeError('invalid inline output');
    }
    return { mimeType, data };
}
