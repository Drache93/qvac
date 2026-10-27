import { runOAuthFlowWithRuntime } from './flow-core.js';
import { isTokenExpired, refreshOAuthTokensWithFetch } from './token-exchange-core.js';
export function createOAuthClient(runtime) {
    return {
        runOAuthFlow: (config, deps) => runOAuthFlowWithRuntime(config, deps, runtime),
        refreshOAuthTokens: (config, refreshToken) => refreshOAuthTokensWithFetch(config, refreshToken, runtime.fetch)
    };
}
export { isTokenExpired };
