import { MAX_IMAGE_WIDTH } from '../core/image/normalize.js';
import { frameTokens } from './video-budget.js';
const PAGE_TOKENS = frameTokens({
    width: MAX_IMAGE_WIDTH,
    height: Math.ceil(MAX_IMAGE_WIDTH * Math.SQRT2)
});
const PDF_SHARE = 0.5;
export const MIN_PDF_PAGE_IMAGES = 2;
export const MAX_PDF_PAGE_IMAGES = 32;
export function pdfPageBudget(ctxSize) {
    const fits = Math.floor((ctxSize * PDF_SHARE) / PAGE_TOKENS);
    return Math.min(MAX_PDF_PAGE_IMAGES, Math.max(MIN_PDF_PAGE_IMAGES, fits));
}
