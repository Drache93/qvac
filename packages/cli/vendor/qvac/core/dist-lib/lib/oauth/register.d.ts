import type { OAuthFetch, OAuthFlowDeps, OAuthProviderConfig } from './types.ts';
export declare function registerOAuthClient(config: OAuthProviderConfig, redirectUri: string, fetchImpl?: OAuthFetch): Promise<string>;
export declare function resolveDynamicClientId(config: OAuthProviderConfig, redirectUri: string, deps: OAuthFlowDeps, fetchImpl?: OAuthFetch): Promise<string>;
