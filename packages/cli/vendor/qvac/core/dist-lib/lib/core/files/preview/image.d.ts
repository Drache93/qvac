import type { AbortSignal } from 'bare-abort-controller';
export type PreviewEncoder = (bytes: Buffer, signal: AbortSignal) => Promise<Buffer>;
export declare function previewEncoder(): Promise<PreviewEncoder | null>;
