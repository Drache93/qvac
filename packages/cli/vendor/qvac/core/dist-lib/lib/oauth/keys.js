export function scopedKey(agentId, key) {
    return agentId ? `skills.${agentId}.${key}` : `skills.${key}`;
}
const TOKEN_AUTH = ['pkce-only', 'secret-in-body', 'secret-in-basic'];
function tokenAuthOf(value) {
    return TOKEN_AUTH.find((candidate) => candidate === value) ?? null;
}
function httpsUrl(value) {
    if (!value)
        return null;
    try {
        return new URL(value).protocol === 'https:' ? value : null;
    }
    catch {
        return null;
    }
}
function portOf(value) {
    if (value === undefined || value === null)
        return null;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535
        ? value
        : null;
}
export function specFromRoute(route) {
    const oauth = route.oauth;
    if (!oauth) {
        return null;
    }
    const tokenAuth = tokenAuthOf(oauth.tokenAuth);
    const authUrl = httpsUrl(oauth.authUrl);
    const tokenUrl = httpsUrl(oauth.tokenUrl);
    if (!route.credentialKey || !oauth.stateKey || !authUrl || !tokenUrl || !tokenAuth) {
        return null;
    }
    if (oauth.stateKey === route.credentialKey) {
        return null;
    }
    if (oauth.port !== undefined && oauth.port !== null && portOf(oauth.port) === null) {
        return null;
    }
    if (oauth.registrationEndpoint && !httpsUrl(oauth.registrationEndpoint)) {
        return null;
    }
    if (oauth.registrationEndpoint && tokenAuth !== 'pkce-only') {
        return null;
    }
    const extraParams = stringRecord(oauth.extraAuthParams);
    const port = portOf(oauth.port);
    return {
        credentialKey: route.credentialKey,
        provider: route.provider ?? route.credentialKey,
        stateKey: oauth.stateKey,
        authUrl,
        tokenUrl,
        tokenAuth,
        scopes: stringList(oauth.scopes),
        extraAuthParams: extraParams ?? undefined,
        registrationEndpoint: oauth.registrationEndpoint || undefined,
        port: port ?? undefined,
        sharedIosSession: oauth.sharedIosSession === true || undefined
    };
}
function stringRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const entries = Object.entries(value).filter((entry) => typeof entry[1] === 'string');
    return entries.length > 0 ? Object.fromEntries(entries) : null;
}
function stringList(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
export const OAUTH_CALLBACK_PATH = '/callback';
export const OAUTH_WAIT_FOR_CODE_TIMEOUT_MS = 120_000;
export function oauthRedirectUri(port) {
    return `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`;
}
