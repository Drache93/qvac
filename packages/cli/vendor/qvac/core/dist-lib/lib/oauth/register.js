import * as z from 'zod';
import { providerRequest } from './request.js';
import { CoreError } from '../errors.js';
const RegistrationResponseSchema = z.object({
    client_id: z.string().min(1)
});
export function registerOAuthClient(config, redirectUri, fetchImpl) {
    return register(config, redirectUri, { fetchImpl });
}
async function register(config, redirectUri, { fetchImpl = globalThis.fetch, timeoutMs }) {
    if (!config.registrationEndpoint) {
        throw new CoreError('OAUTH_REGISTRATION_UNAVAILABLE');
    }
    return await providerRequest({
        fetchImpl,
        url: config.registrationEndpoint,
        init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                client_name: 'QV.AC',
                redirect_uris: [redirectUri],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                token_endpoint_auth_method: 'none',
                application_type: 'native'
            })
        },
        timeoutMs,
        timeout: () => new CoreError('OAUTH_REGISTRATION_TIMEOUT'),
        read: async (response) => {
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new CoreError('OAUTH_REGISTRATION_FAILED', [response.status, text]);
            }
            return RegistrationResponseSchema.parse(await response.json()).client_id;
        }
    });
}
export async function resolveDynamicClientId(config, redirectUri, deps, fetchImpl) {
    const cached = await deps.getClientId?.();
    if (cached) {
        return cached;
    }
    const clientId = await register(config, redirectUri, {
        fetchImpl,
        timeoutMs: deps.requestTimeoutMs
    });
    await deps.saveClientId?.(clientId);
    return clientId;
}
