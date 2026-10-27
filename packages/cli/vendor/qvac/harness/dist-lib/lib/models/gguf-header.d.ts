import { type AbortSignal } from 'bare-abort-controller';
export interface GgufHeader {
    readonly architecture?: string;
    readonly name?: string;
    readonly type?: string;
    readonly license?: string;
    readonly contextLength?: number;
    readonly sizeLabel?: string;
    readonly tags?: ReadonlyArray<string>;
}
export type GgufRangeFetch = (url: string, init: {
    headers: Record<string, string>;
    signal?: AbortSignal;
}) => Promise<{
    ok: boolean;
    status: number;
    headers: {
        get(name: string): string | null;
    };
    arrayBuffer(): Promise<ArrayBuffer>;
}>;
export declare const GGUF_HEADER_BYTES = 1048576;
export declare const GGUF_HEADER_TIMEOUT_MS = 30000;
export declare const GGUF_HEADER_ATTEMPTS = 3;
export declare const GGUF_STUB_MAX_BYTES = 33554432;
export declare const GGUF_STUB_TIMEOUT_MS = 60000;
export declare function isRemoteSource(src: string): boolean;
export declare function localSourcePath(src: string): string | null;
export interface ReadGgufHeaderOptions {
    fetch?: GgufRangeFetch;
    maxBytes?: number;
}
export declare function readGgufHeaderBytes(src: string, opts?: ReadGgufHeaderOptions): Promise<Uint8Array | null>;
export declare function fetchGgufStub(src: string, opts?: ReadGgufHeaderOptions): Promise<Uint8Array | null>;
export declare function ggufDataOffset(bytes: Uint8Array): number | null;
export declare function parseGgufHeader(bytes: Uint8Array): GgufHeader | null;
