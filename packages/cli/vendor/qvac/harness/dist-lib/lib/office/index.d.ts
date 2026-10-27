import type { AbortSignal } from 'bare-abort-controller';
export interface OfficeExtractOptions {
    readonly signal?: AbortSignal | undefined;
    readonly mimeType?: string | undefined;
}
export declare function closeOfficeWorker(): Promise<void>;
export declare function extractOfficeText(bytes: Uint8Array, fileName: string, options?: OfficeExtractOptions): Promise<string>;
