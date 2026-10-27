import { CoreError } from '../errors.js';
export function buildProviderConfig(spec, credentials) {
    const base = {
        clientId: credentials.clientId,
        authUrl: spec.authUrl,
        tokenUrl: spec.tokenUrl,
        scopes: spec.scopes,
        credentialKey: spec.credentialKey,
        port: spec.port ?? 0,
        extraAuthParams: spec.extraAuthParams,
        registrationEndpoint: spec.registrationEndpoint,
        dynamicRegistration: Boolean(spec.registrationEndpoint)
    };
    if (spec.tokenAuth === 'pkce-only') {
        return { ...base, tokenAuth: 'pkce-only' };
    }
    return {
        ...base,
        tokenAuth: spec.tokenAuth,
        clientSecret: requireSecret(credentials.clientSecret, spec.provider)
    };
}
function requireSecret(secret, provider) {
    if (!secret) {
        throw new CoreError('OAUTH_CLIENT_SECRET_MISSING', [provider]);
    }
    return secret;
}
