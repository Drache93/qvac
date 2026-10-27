import type { ToolDefinition } from '../contract/index.ts';
import { type Pdfium, type Source } from './pdf/build.ts';
import { type PdfRequest } from './pdf/request.ts';
export { parsePages, parseRequest } from './pdf/request.ts';
export declare function outputName(request: PdfRequest, inputs: readonly Source[]): string;
export declare function createPdfTool(load?: () => Promise<Pdfium | null>): ToolDefinition;
