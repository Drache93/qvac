import { HarnessError } from '../../errors.js';
import { docx, pptx } from '../../office/engine/index.js';
let pdfium = null;
function loadPdfium() {
    pdfium ??= import('bare-pdfium').then((loaded) => loaded, () => null);
    return pdfium;
}
export function isDocument(key) {
    return /\.(pdf|docx|pptx)$/i.test(key);
}
export async function documentText(key, bytes) {
    if (!/\.pdf$/i.test(key)) {
        const read = /\.docx$/i.test(key) ? docx.open(bytes).read() : pptx.open(bytes).read();
        return collectText(read).join('\n');
    }
    const lib = await loadPdfium();
    if (!lib) {
        throw new HarnessError('PDF_TEXT_UNAVAILABLE');
    }
    const doc = lib.open(bytes);
    try {
        return [...doc.textPages()]
            .map(({ page, text }) => `--- page ${page + 1} ---\n${text.replace(/\r\n?/g, '\n').trim()}`)
            .join('\n');
    }
    finally {
        doc.close();
    }
}
function collectText(value) {
    if (Array.isArray(value)) {
        return value.flatMap(collectText);
    }
    if (typeof value !== 'object' || value === null) {
        return [];
    }
    return Object.entries(value).flatMap(([key, inner]) => key === 'text' && typeof inner === 'string' ? [inner] : collectText(inner));
}
