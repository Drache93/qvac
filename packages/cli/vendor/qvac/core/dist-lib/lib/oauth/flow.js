import { abortOAuthLoopback, openOAuthLoopback } from './loopback.js';
import { randomBase64Url, sha256Base64Url } from '@qvac/core/oauth/runtime/crypto';
import defaultFetch from '@qvac/core/oauth/runtime/fetch';
import { runOAuthFlowWithRuntime } from './flow-core.js';
export function cancelOAuthFlow(target) {
    return abortOAuthLoopback(target.credentialKey);
}
const loopbackRedirect = async (target, deps) => {
    const loopback = await openOAuthLoopback(target.port, {
        credentialKey: target.credentialKey,
        state: target.state
    });
    return {
        redirectUri: loopback.redirectUri,
        async authorize(authUrl, timeoutMs) {
            const callback = loopback.waitForCode(timeoutMs);
            callback.catch(noop);
            await deps.openUrl(authUrl);
            return callback;
        },
        close: () => loopback.close()
    };
};
export function runOAuthFlow(config, deps = {}) {
    return runOAuthFlowWithRuntime(config, { ...deps, createRedirect: deps.createRedirect ?? loopbackRedirect }, { fetch: defaultFetch, randomBase64Url, sha256Base64Url });
}
function noop() { }
