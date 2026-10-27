export declare const MAX_INLINE_BYTES: number;
export declare const MAX_REFERENCE_CHARS: number;
export interface InlinePayload {
    mimeType: string;
    data: string;
}
export declare function inlineReference(bytes: Buffer, mimeType: string): string;
export declare function readInline(record: Record<string, unknown>): InlinePayload | undefined;
