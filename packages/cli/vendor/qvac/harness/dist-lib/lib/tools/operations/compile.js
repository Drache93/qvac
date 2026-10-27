import { z } from 'zod';
import { BUILDERS, BUILDER_POLICY_VERSION } from './builders.js';
import { createHash } from 'crypto';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { READ_METHODS } from '../http-methods.js';
import { truncateResponseBody } from '../http-request/truncate-response.js';
import { DECODERS } from './decoders.js';
export function compileOperationTools(catalog, { httpRequestTool, mcpCallTool }) {
    return catalog.flatMap((entry) => (entry.operations ?? []).flatMap((operation) => {
        const transport = operation.request.transport === 'mcp' ? mcpCallTool : httpRequestTool;
        return transport ? [operationTool(entry.name, operation, transport)] : [];
    }));
}
function operationTool(owningSkill, operation, transportTool) {
    const builder = BUILDERS[operation.request.builder];
    const mcp = operation.request.transport === 'mcp';
    const read = !mcp && READ_METHODS.has(operation.request.method);
    return {
        name: operation.tool,
        policyVersion: createHash('sha256')
            .update(stableStringify({
            owningSkill,
            operation,
            builderVersion: BUILDER_POLICY_VERSION,
            transportVersion: transportTool.policyVersion ?? null
        }))
            .digest('hex'),
        owningSkill,
        description: operation.description,
        parameters: operation.parameters,
        autoApprove: read,
        skillGated: true,
        externalWrite: !read,
        toolset: mcp ? 'mcp-call' : 'http-request',
        compiled: true,
        effect() {
            return read ? 'read' : 'write';
        },
        egress: mcp ? () => operation.request.url : undefined,
        resource() {
            return hostOf(operation.request.url);
        },
        async execute(args, ctx) {
            const skillContext = { ...ctx, skills: [owningSkill] };
            const built = builder.build(args);
            if ('error' in built) {
                return { error: `${operation.tool}: ${built.error}` };
            }
            if (read && (built.request.body !== undefined || built.request.encode !== undefined)) {
                return { error: `${operation.tool}: a read operation cannot send a body` };
            }
            const request = operation.request;
            if (request.transport === 'mcp') {
                return transportTool.execute({ url: request.url, method: request.method, params: built.request.params }, skillContext);
            }
            const url = fillTemplate(request.url, args, request.urlDefaults);
            if ('error' in url) {
                return { error: `${operation.tool}: ${url.error}` };
            }
            const { response } = operation;
            const result = await transportTool.execute({
                url: url.value,
                method: request.method,
                query: { ...request.query, ...built.request.query },
                body: built.request.body,
                encode: built.request.encode
            }, response ? { ...skillContext, uncappedResponse: true } : skillContext);
            return response ? capBody(shapeResponse(result, response)) : result;
        }
    };
}
const JsonResult = z.looseObject({ status: z.number().optional(), body: z.string() });
function capBody(result) {
    const parsed = JsonResult.safeParse(result);
    if (!parsed.success) {
        return result;
    }
    return { ...parsed.data, body: truncateResponseBody(parsed.data.body) };
}
function shapeResponse(result, response) {
    const parsed = JsonResult.safeParse(result);
    if (!parsed.success) {
        return result;
    }
    const { status } = parsed.data;
    if (status !== undefined && status >= 400) {
        return result;
    }
    const body = jsonObject(parsed.data.body);
    if (!body) {
        return result;
    }
    const shaped = 'pick' in response ? pick(body, response.pick) : DECODERS[response.decode].decode(body);
    return { ...parsed.data, body: JSON.stringify(shaped) };
}
function jsonObject(body) {
    try {
        const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(body));
        return parsed.success ? parsed.data : null;
    }
    catch {
        return null;
    }
}
function pick(body, keys) {
    const picked = {};
    for (const key of keys) {
        if (key in body) {
            picked[key] = body[key];
        }
    }
    return picked;
}
const PLACEHOLDER = /\{(\w+)\}/g;
function fillTemplate(template, args, defaults) {
    const missing = [];
    const value = template.replace(PLACEHOLDER, (_match, name) => {
        const filled = args[name] ?? defaults?.[name];
        if (filled === undefined) {
            missing.push(name);
        }
        return encodeURIComponent(String(filled));
    });
    if (missing.length) {
        return { error: `missing required argument ${missing.join(', ')}` };
    }
    return { value };
}
function hostOf(url) {
    try {
        return { kind: 'host', label: new URL(url).hostname };
    }
    catch {
        return null;
    }
}
