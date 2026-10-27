import type { OAuthProviderConfig, OAuthTokens } from './types.ts';
import { isTokenExpired } from './token-exchange-core.ts';
export declare function refreshOAuthTokens(config: OAuthProviderConfig, refreshToken: string): Promise<OAuthTokens>;
export { isTokenExpired };
