import type { LoggerInterface } from '@qvac/logging';
export declare const PDF_RENDER_SCALE = 2;
interface PageFlags {
    hasImage: boolean;
    hasText: boolean;
}
export declare function renderScale(pageWidth: number): number;
export interface PdfDoc {
    pageCount(): number;
    pageFlags(page: number): PageFlags;
    renderPage(page: number): Promise<Uint8Array>;
    close(): void;
}
export interface PdfRasterizer {
    open(bytes: Uint8Array): Promise<PdfDoc | null>;
}
export declare const createPdfRasterizer: (log: LoggerInterface | null) => PdfRasterizer;
export {};
