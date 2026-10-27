import { noRedirectFetch } from '#no-redirect-fetch';
import { AbortController } from 'bare-abort-controller';
import { lookupHost } from '../dns-lookup.js';
import { READ_METHODS } from './http-methods.js';
import { encodeDeclaredFields } from './http-request/encode-fields.js';
import { truncateResponseBody } from './http-request/truncate-response.js';
import { AbortedError } from '../helpers/race-abort.js';
import { applyQuery, buildHeaders, contentTypeOf, encodeBody, isRedirectStatus, parseJsonBody, parseObjectArg, TIMEOUT_MS } from './http-request/request.js';
import { parseAuth, resolveBearerHeader, resolveRedirectBearerHeader } from './skills/auth-resolver.js';
import { recordCredentialHealth } from './skills/credential-health.js';
import { Policy } from '../policy/index.js';
import { resolveOutboundUrl } from './url-guard.js';
const MAX_REDIRECTS = 5;
export function createHttpRequestTool({ policyVersion, fetch: fetchImpl, credentialStore, credentialAllowList, resolveHost = lookupHost } = {}) {
    return {
        name: 'http_request',
        policyVersion,
        toolset: 'http-request',
        defer: true,
        description: 'Make an outbound HTTP or HTTPS request and return the response status and body (truncated) as text. Authorization/Cookie headers are stripped before sending. Stored skill credentials are attached automatically for their allow-listed hosts; `auth` is only needed to force a specific credential key. For APIs and text responses only: a URL that serves a file — PDF, .docx, .xlsx, an image, any binary — comes back as truncated garbage here. Use web_fetch for those; it downloads and attaches the file.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Full http:// or https:// URL' },
                method: {
                    type: 'string',
                    enum: ['GET', 'POST', 'PUT', 'DELETE'],
                    description: 'Defaults to GET'
                },
                headers: { type: 'object', description: 'Optional request headers' },
                query: {
                    type: 'object',
                    description: 'Optional query params appended to the URL. Array values append repeated keys.'
                },
                body: {
                    type: 'object',
                    description: 'Request body, as a JSON object or a string. Objects are JSON-encoded and sent as application/json unless you set Content-Type yourself.'
                },
                encode: {
                    type: 'object',
                    description: 'Optional. Body fields to base64-encode before sending, as {"<dotted.path>": "base64url"}. Pass the field as plain text — never encode it yourself.'
                },
                auth: {
                    type: 'object',
                    description: 'Optional bearer auth: {"type": "bearer", "tokenCredentialKey": "<key>"}. Pass ONLY the credential key name — NEVER a token value. The tool resolves the actual secret itself; the model never sees it.'
                }
            },
            required: ['url']
        },
        autoApprove: false,
        effect(args) {
            const method = typeof args.method === 'string' ? args.method.toUpperCase() : undefined;
            if (method === undefined || !READ_METHODS.has(method)) {
                return 'write';
            }
            return args.body === undefined && args.encode === undefined ? 'read' : 'write';
        },
        egress: (args) => (typeof args.url === 'string' ? args.url : null),
        resource(args) {
            try {
                return { kind: 'host', label: new URL(String(args.url)).hostname };
            }
            catch {
                return null;
            }
        },
        async execute(rawArgs, ctx) {
            const args = rawArgs;
            let url;
            try {
                url = new URL(args.url);
            }
            catch {
                return { error: `invalid URL: ${args.url}` };
            }
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return { error: `unsupported protocol: ${url.protocol}` };
            }
            const query = parseObjectArg(args.query, 'query');
            if (!query.ok) {
                return { error: query.error };
            }
            const encodeArgs = parseObjectArg(args.encode, 'encode');
            if (!encodeArgs.ok) {
                return { error: encodeArgs.error };
            }
            const headerArgs = parseObjectArg(args.headers, 'headers');
            if (!headerArgs.ok) {
                return { error: headerArgs.error };
            }
            const headers = headerArgs.value ? buildHeaders(headerArgs.value) : {};
            const parsedBody = parseJsonBody(args.body, contentTypeOf(headers));
            if (!parsedBody.ok) {
                return { error: parsedBody.error };
            }
            if (query.value) {
                applyQuery(url, query.value);
            }
            const auth = parseAuth(args.auth);
            if (!auth.ok) {
                return { error: auth.error };
            }
            const allowList = credentialAllowList?.(ctx);
            const hosts = Policy.hostsOf(ctx?.policy);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(undefined), TIMEOUT_MS);
            try {
                const initialCheck = await resolveOutboundUrl(url, {
                    resolveHost,
                    signal: controller.signal,
                    hosts
                });
                if (initialCheck.blocked) {
                    return { error: initialCheck.blocked };
                }
                const bearer = await resolveBearerHeader(auth.value, url, credentialStore, allowList, ctx, controller.signal);
                if ('error' in bearer) {
                    return { error: bearer.error };
                }
                const redirectAuth = bearer.credentialKey
                    ? { type: 'bearer', tokenCredentialKey: bearer.credentialKey }
                    : undefined;
                const encoded = encodeDeclaredFields(parsedBody.value, encodeArgs.value);
                const requestBody = encodeBody(encoded, headers);
                const fetch = fetchImpl ?? noRedirectFetch;
                let currentUrl = url;
                let method = args.method ?? 'GET';
                let body = requestBody;
                let header = bearer.header;
                let credentialKey = bearer.credentialKey;
                let validatedAddresses = initialCheck.addresses;
                let response;
                for (let redirects = 0;; redirects++) {
                    const hopHeaders = { ...headers };
                    delete hopHeaders['Authorization'];
                    if (header) {
                        hopHeaders['Authorization'] = header;
                    }
                    response = await fetch(currentUrl, {
                        method,
                        headers: hopHeaders,
                        body,
                        signal: controller.signal,
                        redirect: 'manual',
                        validatedAddresses
                    });
                    if (credentialKey) {
                        recordCredentialHealth(credentialKey, response.status, ctx?.agentId);
                    }
                    if (!isRedirectStatus(response.status)) {
                        break;
                    }
                    const location = response.headers?.get('location');
                    if (!location) {
                        break;
                    }
                    let nextUrl;
                    try {
                        nextUrl = new URL(location, currentUrl);
                    }
                    catch {
                        break;
                    }
                    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
                        break;
                    }
                    if (redirects >= MAX_REDIRECTS) {
                        return { error: 'too many redirects' };
                    }
                    const hopCheck = await resolveOutboundUrl(nextUrl, {
                        resolveHost,
                        signal: controller.signal,
                        hosts
                    });
                    if (hopCheck.blocked) {
                        return { error: hopCheck.blocked };
                    }
                    if (response.status === 303 ||
                        ((response.status === 301 || response.status === 302) && method === 'POST')) {
                        method = 'GET';
                        body = undefined;
                    }
                    currentUrl = nextUrl;
                    validatedAddresses = hopCheck.addresses;
                    const next = await resolveRedirectBearerHeader(redirectAuth, currentUrl, credentialStore, allowList, ctx, controller.signal);
                    header = next.header;
                    credentialKey = next.credentialKey;
                }
                const text = await response.text();
                return {
                    status: response.status,
                    body: ctx?.uncappedResponse ? text : truncateResponseBody(text)
                };
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                const timedOut = error.name === 'AbortError' || error instanceof AbortedError;
                return {
                    error: timedOut ? 'request timed out' : `request failed: ${error.message}`,
                    code: timedOut ? 'timeout' : 'transport'
                };
            }
            finally {
                clearTimeout(timeout);
            }
        }
    };
}
