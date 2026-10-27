import type { OAuthFetch, OAuthFlowDeps, OAuthProviderConfig, OAuthTokens } from './types.ts';
export interface CodeExchange {
    readonly clientId: string;
    readonly redirectUri: string;
    readonly code: string;
    readonly verifier: string;
    readonly deps: OAuthFlowDeps;
}
export interface CodeExchangeWithFetch extends CodeExchange {
    readonly fetchImpl: OAuthFetch;
}
export declare function exchangeCodeWithFetch(config: OAuthProviderConfig, { clientId, redirectUri, code, verifier, deps, fetchImpl }: CodeExchangeWithFetch): Promise<OAuthTokens>;
export declare function refreshOAuthTokensWithFetch(config: OAuthProviderConfig, refreshToken: string, fetchImpl: OAuthFetch): Promise<OAuthTokens>;
export declare function isTokenExpired(record: Pick<OAuthTokens, 'expiresAt'>, bufferMs?: number): boolean;
