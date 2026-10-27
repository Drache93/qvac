export interface FetchRequestLike {
    on(event: 'error', listener: (err: Error) => void): void;
    write(chunk: string | Uint8Array): void;
    end(): void;
    destroy(err?: Error): void;
}
export interface FetchResponseLike {
    statusCode: number;
    headers: Record<string, string | string[] | number | undefined>;
    on(event: 'data', listener: (chunk: Uint8Array) => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: 'end', listener: () => void): void;
}
export type BareRequestFn<Response extends FetchResponseLike = FetchResponseLike, Request extends FetchRequestLike = FetchRequestLike> = (url: URL, opts: {
    method: string;
    headers: Record<string, string>;
    validatedAddresses?: readonly string[] | undefined;
}, onresponse: (res: Response) => void) => Request;
export interface NoRedirectFetchInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    signal?: {
        readonly aborted: boolean;
        addEventListener(type: 'abort', listener: () => void): void;
    };
    validatedAddresses?: readonly string[] | undefined;
    maxBytes?: number;
    truncate?: boolean;
}
export interface NoRedirectFetchResponse {
    status: number;
    headers: {
        get(name: string): string | null;
        entries(): [string, string][];
    };
    text(): string;
    bytes(): Uint8Array;
}
export declare function runNoRedirectFetch<Response extends FetchResponseLike, Request extends FetchRequestLike>(request: BareRequestFn<Response, Request>, url: URL, init?: NoRedirectFetchInit): Promise<NoRedirectFetchResponse>;
