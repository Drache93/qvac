import type { OAuthFlowDeps, OAuthProviderConfig, OAuthTokens } from './types.ts';
export declare function cancelOAuthFlow(target: Pick<OAuthProviderConfig, 'credentialKey'>): Promise<boolean>;
export declare function runOAuthFlow(config: OAuthProviderConfig, deps?: OAuthFlowDeps): Promise<OAuthTokens>;
