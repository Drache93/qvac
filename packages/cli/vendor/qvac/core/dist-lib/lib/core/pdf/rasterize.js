import { MAX_IMAGE_WIDTH, rasterToModelJpeg } from '../image/normalize.js';
export const PDF_RENDER_SCALE = 2;
export function renderScale(pageWidth) {
    return Math.min(PDF_RENDER_SCALE, MAX_IMAGE_WIDTH / pageWidth);
}
let pdfium;
async function loadPdfium(log) {
    if (pdfium !== undefined)
        return pdfium;
    try {
        const mod = await import('bare-pdfium');
        pdfium = mod.default ?? mod;
    }
    catch (err) {
        log?.warn('pdf', 'bare-pdfium did not load; PDF pages will not render', err);
        pdfium = null;
    }
    return pdfium;
}
export const createPdfRasterizer = (log) => ({
    async open(bytes) {
        const mod = await loadPdfium(log);
        if (!mod) {
            return null;
        }
        let doc;
        try {
            doc = mod.open(bytes);
        }
        catch {
            return null;
        }
        return {
            pageCount() {
                return doc.pageCount();
            },
            pageFlags(page) {
                return doc.pageFlags(page);
            },
            async renderPage(page) {
                const scale = renderScale(doc.pageSize(page).width);
                const jpeg = await rasterToModelJpeg(await doc.renderAsync(page, { scale }));
                if (!jpeg) {
                    throw new Error('no JPEG encoder: bare-media did not load');
                }
                return jpeg;
            },
            close() {
                try {
                    doc.close();
                }
                catch { }
            }
        };
    }
});
