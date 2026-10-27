import { CoreError } from '../errors.js';
import { generateRuntimePkceChallenge } from './pkce-runtime.js';
import { resolveDynamicClientId } from './register.js';
import { exchangeCodeWithFetch } from './token-exchange-core.js';
function buildAuthParams(config, { clientId, redirectUri, state, pkce }) {
    const params = new URLSearchParams({
        ...config.extraAuthParams,
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256'
    });
    if (config.scopes.length > 0) {
        params.set('scope', config.scopes.join(' '));
    }
    return params;
}
export async function runOAuthFlowWithRuntime(config, deps, runtime) {
    const openUrl = deps.openUrl ?? (() => Promise.reject(new CoreError('OAUTH_LAUNCHER_UNAVAILABLE')));
    const pkce = await generateRuntimePkceChallenge(runtime);
    const state = runtime.randomBase64Url(16);
    const redirect = await deps.createRedirect({ port: config.port, credentialKey: config.credentialKey, state }, { openUrl });
    try {
        const clientId = config.dynamicRegistration && !config.clientId
            ? await resolveDynamicClientId(config, redirect.redirectUri, deps, runtime.fetch)
            : config.clientId;
        const authParams = buildAuthParams(config, {
            clientId,
            redirectUri: redirect.redirectUri,
            state,
            pkce
        });
        deps.onStage?.('awaiting-callback');
        const callback = await redirect.authorize(`${config.authUrl}?${authParams.toString()}`, deps.timeoutMs, state);
        if (callback.state !== state) {
            throw new CoreError('OAUTH_STATE_MISMATCH');
        }
        deps.onStage?.('exchanging-code');
        return exchangeCodeWithFetch(config, {
            clientId,
            redirectUri: redirect.redirectUri,
            code: callback.code,
            verifier: pkce.verifier,
            deps,
            fetchImpl: runtime.fetch
        });
    }
    finally {
        redirect.close();
    }
}
