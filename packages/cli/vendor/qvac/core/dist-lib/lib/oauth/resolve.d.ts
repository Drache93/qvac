import type { OAuthTokens } from './types.ts';
export declare const REFRESH_SKEW_MS = 60000;
export interface FetchResponse {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
export type Fetch = (url: string, init?: object) => Promise<FetchResponse>;
export interface ConfigEngine {
    configGet(req: {
        key: string;
    }): Promise<{
        value?: unknown;
    }>;
    configSet(req: {
        key: string;
        value: string;
    }): Promise<unknown>;
}
type RefreshFn = (opts: {
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
    fetch?: Fetch;
}) => Promise<OAuthTokens>;
export interface ResolveOAuthCredentialOptions {
    readonly engine: ConfigEngine;
    readonly agentId?: string;
    readonly credentialKey: string;
    readonly stateKey: string;
    readonly refresh: RefreshFn;
    readonly requireClientSecret?: boolean;
    readonly fetch?: Fetch;
}
export declare function resolveOAuthCredential(opts: ResolveOAuthCredentialOptions): Promise<string | null>;
export {};
