import { scopedKey } from './keys.js';
export const REFRESH_SKEW_MS = 60_000;
const inFlightRefresh = new Map();
export async function resolveOAuthCredential(opts) {
    const { engine, agentId, credentialKey, stateKey, refresh, requireClientSecret = false } = opts;
    const { value: token } = await engine.configGet({ key: scopedKey(agentId, credentialKey) });
    if (typeof token !== 'string') {
        return null;
    }
    const { value: raw } = await engine.configGet({ key: scopedKey(agentId, stateKey) });
    if (typeof raw !== 'string') {
        return token;
    }
    let stored;
    try {
        stored = JSON.parse(raw);
    }
    catch {
        return token;
    }
    const { refreshToken, expiresAt, clientId, clientSecret } = stored ?? {};
    if (!refreshToken || !clientId) {
        return token;
    }
    if (requireClientSecret && !clientSecret) {
        return token;
    }
    if (typeof expiresAt !== 'number' || expiresAt - REFRESH_SKEW_MS > Date.now()) {
        return token;
    }
    const refreshKey = `${credentialKey}:${agentId ?? ''}`;
    try {
        let pending = inFlightRefresh.get(refreshKey);
        if (!pending) {
            pending = (async () => {
                const refreshed = await refresh({
                    clientId,
                    clientSecret,
                    refreshToken,
                    fetch: opts.fetch
                });
                await engine.configSet({
                    key: scopedKey(agentId, credentialKey),
                    value: refreshed.accessToken
                });
                await engine.configSet({
                    key: scopedKey(agentId, stateKey),
                    value: JSON.stringify({
                        ...stored,
                        refreshToken: refreshed.refreshToken ?? refreshToken,
                        expiresAt: refreshed.expiresAt
                    })
                });
                return refreshed.accessToken;
            })().finally(() => inFlightRefresh.delete(refreshKey));
            inFlightRefresh.set(refreshKey, pending);
        }
        return await pending;
    }
    catch {
        return token;
    }
}
