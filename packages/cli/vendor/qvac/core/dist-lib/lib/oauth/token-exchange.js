import defaultFetch from '@qvac/core/oauth/runtime/fetch';
import { isTokenExpired, refreshOAuthTokensWithFetch } from './token-exchange-core.js';
export function refreshOAuthTokens(config, refreshToken) {
    return refreshOAuthTokensWithFetch(config, refreshToken, defaultFetch);
}
export { isTokenExpired };
