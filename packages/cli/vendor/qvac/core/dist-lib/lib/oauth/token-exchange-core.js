import * as z from 'zod';
import { providerRequest } from './request.js';
import { CoreError } from '../errors.js';
const TokenResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional()
});
const TokenErrorSchema = z.object({
    error: z.string(),
    error_description: z.string().optional()
});
function parseTokenResponse(raw) {
    const failure = TokenErrorSchema.safeParse(raw);
    if (failure.success) {
        const detail = failure.data.error_description;
        throw new CoreError('OAUTH_TOKEN_ERROR', [failure.data.error, detail]);
    }
    return TokenResponseSchema.parse(raw);
}
function applyClientSecret(config, body, headers) {
    if (config.tokenAuth === 'secret-in-body') {
        body.set('client_secret', config.clientSecret);
    }
    else if (config.tokenAuth === 'secret-in-basic') {
        headers.Authorization = `Basic ${globalThis.btoa(`${config.clientId}:${config.clientSecret}`)}`;
    }
}
function toTokens(raw, fallbackRefresh) {
    return {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token ?? fallbackRefresh,
        expiresAt: raw.expires_in ? Date.now() + raw.expires_in * 1000 : undefined,
        scope: raw.scope
    };
}
export async function exchangeCodeWithFetch(config, { clientId, redirectUri, code, verifier, deps, fetchImpl }) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
    };
    applyClientSecret(config, body, headers);
    return await providerRequest({
        fetchImpl,
        url: config.tokenUrl,
        init: { method: 'POST', headers, body: body.toString() },
        timeoutMs: deps.requestTimeoutMs,
        timeout: () => new CoreError('OAUTH_TOKEN_EXCHANGE_TIMEOUT'),
        read: async (response) => {
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                if (config.dynamicRegistration && /invalid_client/i.test(text)) {
                    await deps.clearClientId?.();
                }
                throw new CoreError('OAUTH_TOKEN_EXCHANGE_FAILED', [response.status, text]);
            }
            return toTokens(parseTokenResponse(await response.json()));
        }
    });
}
export async function refreshOAuthTokensWithFetch(config, refreshToken, fetchImpl) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
    };
    applyClientSecret(config, body, headers);
    return await providerRequest({
        fetchImpl,
        url: config.tokenUrl,
        init: { method: 'POST', headers, body: body.toString() },
        timeout: () => new CoreError('OAUTH_TOKEN_REFRESH_TIMEOUT'),
        read: async (response) => {
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new CoreError('OAUTH_TOKEN_REFRESH_FAILED', [response.status, text]);
            }
            return toTokens(parseTokenResponse(await response.json()), refreshToken);
        }
    });
}
export function isTokenExpired(record, bufferMs = 60_000) {
    return typeof record.expiresAt === 'number' && Date.now() + bufferMs >= record.expiresAt;
}
