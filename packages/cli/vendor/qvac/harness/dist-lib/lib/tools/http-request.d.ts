import type { ToolDefinition } from '../contract/index.ts';
import { type FetchInit } from './http-request/request.ts';
import { type CredentialAllowListFn, type CredentialStoreFn } from './skills/auth-resolver.ts';
import { type HostResolver } from './url-guard.ts';
export type FetchFn = (url: URL, init: FetchInit) => Promise<{
    status: number;
    headers?: {
        get(name: string): string | null;
    };
    text(): Promise<string> | string;
    bytes?(): Promise<Uint8Array> | Uint8Array;
}>;
export type { CredentialAllowList, CredentialAllowListFn, CredentialRecord, CredentialStoreFn, CredentialStoreValue } from './skills/auth-resolver.ts';
export interface HttpRequestToolOptions {
    policyVersion?: string;
    fetch?: FetchFn;
    credentialStore?: CredentialStoreFn;
    credentialAllowList?: CredentialAllowListFn;
    resolveHost?: HostResolver;
}
export declare function createHttpRequestTool({ policyVersion, fetch: fetchImpl, credentialStore, credentialAllowList, resolveHost }?: HttpRequestToolOptions): ToolDefinition;
