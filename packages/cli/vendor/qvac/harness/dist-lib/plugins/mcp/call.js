import { AbortController } from 'bare-abort-controller';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { isMetadataMethod } from '../../lib/helpers/mcp-methods.js';
import { writeResult } from '../../lib/helpers/run-outcome.js';
import { isRedirectStatus, parseObjectArg } from '../../lib/tools/http-request/request.js';
import { parseAuth, resolveBearerHeader } from '../../lib/tools/skills/index.js';
import { recordCredentialHealth } from '../../lib/tools/skills/credential-health.js';
import { cacheSession, deleteSession, establishSession, flattenMcpResponse, getSession, isNotification, needsSession, normalizeMethod, post, readBody, sessionKey, TIMEOUT_MS } from './protocol.js';
const MCP_CALL_TOOL_NAME = 'mcp_call';
function nestedUrl(params) {
    return typeof params?.url === 'string' && params.url.length > 0 ? params.url : undefined;
}
function parseMcpParams(value) {
    const parsed = parseObjectArg(value, 'params');
    if (parsed.ok || typeof value !== 'string') {
        return parsed;
    }
    return parseObjectArg(value.replace(/[“”]/g, '"'), 'params');
}
function toolParams(params, liftedNestedUrl) {
    if (!params || !liftedNestedUrl)
        return params;
    const result = { ...params };
    delete result.url;
    return Object.keys(result).length > 0 ? result : undefined;
}
function mcpTargetUrl(args) {
    if (typeof args.url === 'string' && args.url.length > 0)
        return args.url;
    const parsed = parseMcpParams(args.params);
    return parsed.ok ? (nestedUrl(parsed.value) ?? '') : '';
}
export async function sendMcp(request, ctx) {
    const fetch = ctx?.fetch;
    if (!fetch) {
        return { error: 'request failed: no fetch for this call', code: 'transport' };
    }
    const { url, auth, credentialStore, credentialAllowList } = request;
    const { method, params } = normalizeMethod(request.method, request.params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(undefined), TIMEOUT_MS);
    try {
        const bearer = await resolveBearerHeader(auth, url, credentialStore, credentialAllowList, ctx, controller.signal);
        if ('error' in bearer) {
            return { error: bearer.error };
        }
        const authHeader = bearer.header;
        const key = sessionKey(url.href, ctx, bearer.credentialKey);
        const cached = getSession(key);
        let response = await post(fetch, url, {
            method,
            params,
            authHeader,
            sessionId: cached || undefined,
            signal: controller.signal
        });
        if (needsSession(response.status, cached)) {
            deleteSession(key);
            const session = await establishSession(fetch, url, {
                authHeader,
                signal: controller.signal
            });
            if (typeof session === 'string') {
                cacheSession(key, session);
                response = await post(fetch, url, {
                    method,
                    params,
                    authHeader,
                    sessionId: session,
                    signal: controller.signal
                });
            }
            else if (!session.stateless) {
                return { error: session.error };
            }
        }
        else {
            const issued = response.headers.get('mcp-session-id');
            if (issued) {
                cacheSession(key, issued);
            }
        }
        if (isRedirectStatus(response.status)) {
            return { error: `MCP server responded with an unexpected redirect (${response.status})` };
        }
        if (bearer.credentialKey) {
            recordCredentialHealth(bearer.credentialKey, response.status, ctx?.agentId);
        }
        if (isNotification(method)) {
            return { status: response.status, body: '' };
        }
        return { status: response.status, ...flattenMcpResponse(await readBody(response)) };
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
export function createMcpCallTool({ credentialStore, credentialAllowList, readMethods } = {}) {
    return {
        name: MCP_CALL_TOOL_NAME,
        toolset: 'mcp-call',
        description: 'Make a JSON-RPC 2.0 call to a Model Context Protocol (MCP) server. Load the matching skill first — it documents the server tool names and their args. Pass a server tool name as `method` and its args as `params`; the JSON-RPC envelope, session handshake, and bearer auth are handled for you (the stored credential for the host is attached automatically, so no `auth` is needed).',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Required top-level MCP server URL (https://)' },
                method: {
                    type: 'string',
                    description: 'A server tool name (wrapped into tools/call) or a raw MCP method'
                },
                params: {
                    type: 'object',
                    description: "The server tool's arguments only; put the MCP server URL in top-level url"
                },
                auth: {
                    type: 'object',
                    description: 'Optional bearer auth: {"type": "bearer", "tokenCredentialKey": "<key>"}. Pass ONLY the credential key name — never a token value.'
                }
            },
            required: ['url', 'method']
        },
        autoApprove: false,
        effect(args) {
            if (typeof args.method !== 'string')
                return 'write';
            try {
                const host = new URL(mcpTargetUrl(args)).hostname;
                return readMethods?.get(host)?.has(args.method) ? 'read' : 'write';
            }
            catch {
                return 'write';
            }
        },
        egress: mcpTargetUrl,
        resource(args) {
            try {
                return { kind: 'host', label: new URL(mcpTargetUrl(args)).hostname };
            }
            catch {
                return null;
            }
        },
        landedWrite(args, output) {
            if (isMetadataMethod(args.method)) {
                return null;
            }
            return writeResult(output);
        },
        async execute(args, ctx) {
            const rawParams = parseMcpParams(args.params);
            if (!rawParams.ok) {
                return { error: rawParams.error };
            }
            const topLevelUrl = typeof args.url === 'string' && args.url.length > 0 ? args.url : undefined;
            const urlValue = topLevelUrl ?? nestedUrl(rawParams.value);
            let url;
            try {
                url = new URL(urlValue ?? '');
            }
            catch {
                return { error: `invalid URL: ${String(urlValue)}` };
            }
            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                return { error: `unsupported protocol: ${url.protocol}` };
            }
            if (typeof args.method !== 'string' || args.method.length === 0) {
                return { error: 'method must be a non-empty string' };
            }
            const parsedAuth = parseAuth(args.auth);
            if (!parsedAuth.ok) {
                return { error: parsedAuth.error };
            }
            return sendMcp({
                url,
                method: args.method,
                params: toolParams(rawParams.value, topLevelUrl === undefined && urlValue !== undefined),
                auth: parsedAuth.value,
                credentialStore,
                credentialAllowList: credentialAllowList?.(ctx)
            }, ctx);
        }
    };
}
