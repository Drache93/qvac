import { type OAuthRuntimeFlowDeps } from './flow-core.ts';
import { isTokenExpired } from './token-exchange-core.ts';
import type { OAuthProviderConfig, OAuthRuntime, OAuthTokens } from './types.ts';
export interface OAuthClient {
    readonly runOAuthFlow: (config: OAuthProviderConfig, deps: OAuthRuntimeFlowDeps) => Promise<OAuthTokens>;
    readonly refreshOAuthTokens: (config: OAuthProviderConfig, refreshToken: string) => Promise<OAuthTokens>;
}
export declare function createOAuthClient(runtime: OAuthRuntime): OAuthClient;
export { isTokenExpired };
