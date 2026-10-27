import type { AbortSignal } from 'bare-abort-controller';
export interface DocxExtractOptions {
    readonly signal?: AbortSignal;
}
export declare function extractDocxText(bytes: Uint8Array, fileName: string, options?: DocxExtractOptions): Promise<string>;
