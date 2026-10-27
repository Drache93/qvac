import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export declare const MAX_RESPONSE_CHARS = 8192;
export declare const TIMEOUT_MS = 10000;
export interface FetchInit {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal: BareAbortSignal;
    redirect?: 'manual';
    validatedAddresses?: readonly string[] | undefined;
    maxBytes?: number;
    truncate?: boolean;
}
export declare function isRedirectStatus(status: number): boolean;
export type ParseResult<T> = {
    readonly ok: true;
    readonly value: T | undefined;
} | {
    readonly ok: false;
    readonly error: string;
};
export declare function parseObjectArg(v: unknown, name: string): ParseResult<Record<string, unknown>>;
export declare function parseJsonBody(body: string | Record<string, unknown> | undefined, contentType?: string): ParseResult<string | Record<string, unknown>>;
export declare function applyQuery(url: URL, query: Record<string, unknown>): void;
export declare function contentTypeOf(headers: unknown): string | undefined;
export declare function buildHeaders(headerArgs: Record<string, unknown>): Record<string, string>;
export declare function encodeBody(body: string | Record<string, unknown> | undefined, headers: Record<string, string>): string | undefined;
