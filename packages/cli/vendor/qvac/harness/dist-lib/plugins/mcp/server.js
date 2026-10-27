import { AbortController } from 'bare-abort-controller';
import { createHash } from 'crypto';
import { z } from 'zod';
import { isRecord } from '../../lib/guards.js';
import { resolveBearerHeader } from '../../lib/tools/skills/index.js';
import { sendMcp } from './call.js';
import { establishSession, post, readBody } from './protocol.js';
const InputSchema = z.looseObject({
    properties: z.record(z.string(), z.custom(isRecord)).optional(),
    required: z.array(z.string()).optional()
});
const Listed = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    inputSchema: InputSchema.optional()
});
const ListPage = z.object({
    result: z.object({ tools: z.array(z.unknown()), nextCursor: z.string().optional() })
});
function bearerAuth(server) {
    return server.auth
        ? { type: 'bearer', tokenCredentialKey: server.auth.tokenCredentialKey }
        : undefined;
}
function allowListOf(server) {
    return server.auth ? { [server.auth.tokenCredentialKey]: [server.url] } : undefined;
}
export async function listServerTools(server, { fetch, credentialStore, timeoutMs }) {
    const url = new URL(server.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(undefined), timeoutMs);
    const { signal } = controller;
    try {
        const bearer = await resolveBearerHeader(bearerAuth(server), url, server.auth ? credentialStore : undefined, allowListOf(server), undefined, signal);
        if ('error' in bearer) {
            throw new Error(bearer.error);
        }
        const authHeader = bearer.header;
        const session = await establishSession(fetch, url, { authHeader, signal });
        if (typeof session !== 'string' && !session.stateless) {
            throw new Error(session.error);
        }
        const sessionId = typeof session === 'string' ? session : undefined;
        const listed = [];
        let cursor;
        do {
            const response = await post(fetch, url, {
                method: 'tools/list',
                params: cursor === undefined ? undefined : { cursor },
                authHeader,
                sessionId,
                signal
            });
            const body = await readBody(response);
            if (response.status < 200 || response.status >= 300) {
                throw new Error(`tools/list failed: ${response.status}`);
            }
            const page = ListPage.parse(JSON.parse(body)).result;
            listed.push(...page.tools.flatMap(listedTool));
            cursor = page.nextCursor;
        } while (cursor);
        return listed;
    }
    finally {
        clearTimeout(timeout);
    }
}
function listedTool(entry) {
    const parsed = Listed.safeParse(entry);
    if (!parsed.success) {
        return [];
    }
    const { name, description, inputSchema } = parsed.data;
    return [
        {
            name,
            description: description ?? '',
            parameters: { ...inputSchema, type: 'object', properties: inputSchema?.properties ?? {} }
        }
    ];
}
export function serverTool(server, listed, credentialStore) {
    const url = new URL(server.url);
    const auth = bearerAuth(server);
    const credentialAllowList = allowListOf(server);
    const tool = {
        name: `${server.name}__${listed.name}`,
        policyVersion: createHash('sha256')
            .update(JSON.stringify({ url: server.url, name: listed.name, parameters: listed.parameters }))
            .digest('hex'),
        description: listed.description,
        parameters: listed.parameters,
        toolset: 'mcp-call',
        externalWrite: true,
        effect: () => 'write',
        egress: () => server.url,
        resource: () => ({ kind: 'host', label: url.hostname }),
        execute: (args, ctx) => sendMcp({
            url,
            method: 'tools/call',
            params: { name: listed.name, arguments: args },
            auth,
            credentialStore: auth ? credentialStore : undefined,
            credentialAllowList
        }, ctx)
    };
    return server.defer === false ? tool : { ...tool, defer: true, group: server.name };
}
