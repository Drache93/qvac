import type { OAuthFetch } from './types.ts';
export interface ProviderRequest<T> {
    readonly fetchImpl: OAuthFetch;
    readonly url: string;
    readonly init: RequestInit;
    readonly timeoutMs?: number | undefined;
    readonly timeout: () => Error;
    readonly read: (response: Response) => Promise<T>;
}
export declare function providerRequest<T>({ fetchImpl, url, init, timeoutMs, timeout, read }: ProviderRequest<T>): Promise<T>;
