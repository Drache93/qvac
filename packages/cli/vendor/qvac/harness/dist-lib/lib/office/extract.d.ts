import type { AbortSignal } from 'bare-abort-controller';
export type Extract = (bytes: Uint8Array) => string;
export interface ExtractJob {
    readonly fileName: string;
    readonly signal: AbortSignal | undefined;
    readonly extract: Extract;
}
export declare function extractWith(bytes: Uint8Array, { fileName, signal, extract }: ExtractJob): string;
export declare function cellText(value: unknown): string;
