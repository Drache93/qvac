import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { HarnessError } from '../../lib/errors.ts';
import type { Fetcher } from './types.ts';
export declare const ENGINE_TIMEOUT_MS = 8000;
export declare const MAX_HTML_CHARS = 2000000;
export declare class TimeoutError extends HarnessError<'FETCH_TIMED_OUT'> {
    constructor(ms: number);
}
export declare class AbortError extends HarnessError<'FETCH_CANCELLED'> {
    constructor();
}
interface FetchOptions {
    readonly method?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
    readonly cookies?: Readonly<Record<string, string>>;
    readonly accept?: string;
    readonly timeoutMs?: number;
    readonly signal?: BareAbortSignal;
}
export declare function fetchHtml(fetcher: Fetcher, url: string, options?: FetchOptions): Promise<string>;
export declare class JsonParseError extends HarnessError<'RESPONSE_NOT_JSON'> {
    constructor(chars: number, cause: unknown);
}
export declare function fetchJson(fetcher: Fetcher, url: string, options?: FetchOptions): Promise<unknown>;
export {};
