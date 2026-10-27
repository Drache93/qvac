import { type HostResolver } from './tools/url-guard.ts';
import type { NoRedirectFetchInit, NoRedirectFetchResponse } from './no-redirect-fetch-impl.ts';
export declare const MAX_RESPONSE_BYTES: number;
type NoRedirectFetch = (url: URL, init?: NoRedirectFetchInit) => Promise<NoRedirectFetchResponse>;
interface SignalLike {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void): void;
}
interface RequestLike {
    url: string;
}
interface FetchInit {
    method?: string;
    headers?: unknown;
    body?: unknown;
    signal?: SignalLike | null;
    redirect?: string;
}
export interface GuardedFetchOptions {
    readonly fetch?: NoRedirectFetch;
    readonly mayConnect?: (host: string) => Promise<boolean>;
    readonly signal?: SignalLike;
    readonly resolveHost?: HostResolver;
    readonly maxBytes?: number;
    readonly timeoutMs?: number;
}
declare class GuardedHeaders {
    #private;
    constructor(entries: [string, string][]);
    get(name: string): string | null;
    has(name: string): boolean;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    forEach(fn: (value: string, key: string) => void): void;
    [Symbol.iterator](): IterableIterator<[string, string]>;
}
export interface GuardedResponseInit {
    readonly status: number;
    readonly headers: [string, string][];
    readonly url: string;
    readonly redirected: boolean;
}
interface BodyChunk {
    done: boolean;
    value?: Uint8Array;
}
interface BodyReader {
    read(): Promise<BodyChunk>;
    cancel(): Promise<void>;
    releaseLock(): void;
}
interface ResponseBody {
    getReader(): BodyReader;
}
export declare class GuardedResponse {
    #private;
    readonly type = "basic";
    readonly statusText = "";
    readonly status: number;
    readonly headers: GuardedHeaders;
    readonly url: string;
    readonly redirected: boolean;
    constructor(bytes: Uint8Array, { status, headers, url, redirected }: GuardedResponseInit);
    get ok(): boolean;
    get bodyUsed(): boolean;
    get body(): ResponseBody;
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
    text(): Promise<string>;
    json(): Promise<unknown>;
    clone(): GuardedResponse;
}
export type GuardedFetch = (input: string | URL | RequestLike, init?: FetchInit) => Promise<GuardedResponse>;
export declare function createGuardedFetch(options?: GuardedFetchOptions): GuardedFetch;
export {};
