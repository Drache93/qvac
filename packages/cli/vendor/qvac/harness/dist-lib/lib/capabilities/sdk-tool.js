import { buildToolSearchTool, executeToolSearch, loadedToolNames, TOOL_SEARCH_NAME } from '@qvac/inference/surface';
import { INTENT_PARAM, INTENT_PARAM_DESCRIPTION } from '../helpers/tool-intent.js';
import { isFailureResultReference } from '../helpers/failure-result.js';
import { Agent } from '../agent/index.js';
import { toolGuidelines } from '../prompt.js';
export const TOOL_SEARCH_TOOL_NAME = TOOL_SEARCH_NAME;
function intentParameters(tool, params) {
    if (tool.autoApprove === true || INTENT_PARAM in params.properties) {
        return params;
    }
    return {
        ...params,
        properties: {
            [INTENT_PARAM]: { type: 'string', description: INTENT_PARAM_DESCRIPTION },
            ...params.properties
        },
        required: [INTENT_PARAM, ...(params.required ?? [])]
    };
}
function sdkParameterSchema(schema) {
    const { sensitive: _sensitive, properties, items, ...rest } = schema;
    return {
        ...rest,
        properties: properties
            ? Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, sdkParameterSchema(value)]))
            : undefined,
        items: items ? sdkParameterSchema(items) : undefined
    };
}
function sdkParameters(parameters) {
    return {
        ...parameters,
        properties: Object.fromEntries(Object.entries(parameters.properties).map(([key, value]) => [key, sdkProperty(value)]))
    };
}
function sdkProperty(schema) {
    const notes = [
        schema.properties && `Fields: ${shape(schema)}`,
        schema.items && `Each item: ${shape(schema.items)}`,
        schema.default !== undefined && `Default: ${JSON.stringify(schema.default)}`
    ].filter((note) => typeof note === 'string');
    if (notes.length === 0) {
        return sdkParameterSchema(schema);
    }
    return { ...sdkParameterSchema(schema), description: folded(schema.description, notes) };
}
function folded(description, notes) {
    const lead = description ? [description.replace(/(?<![.!?:])$/, '.')] : [];
    return [...lead, notes.join('. ')].join(' ');
}
function shape(schema) {
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join('|');
    }
    if (schema.properties) {
        const required = schema.required ?? [];
        const fields = Object.entries(schema.properties).map(([name, value]) => field(name, value, required.includes(name)));
        return `{${fields.join('; ')}}`;
    }
    if (schema.items) {
        const item = shape(schema.items);
        return item.includes('|') && !item.startsWith('{') ? `(${item})[]` : `${item}[]`;
    }
    return typeof schema.type === 'string' ? schema.type : schema.type.join('|');
}
function field(name, schema, required) {
    const optional = required ? '' : '?';
    const fallback = schema.default === undefined ? '' : ` = ${JSON.stringify(schema.default)}`;
    const description = schema.description ? `: ${schema.description.replace(/\.$/, '')}` : '';
    return `${name}${optional}: ${shape(schema)}${fallback}${description}`;
}
export function defers(tool) {
    return (tool.defer === true || tool.skillGated === true) && !tool.endsRun && !tool.callsTools;
}
export function deferredForRun(tool) {
    const deferred = { ...tool, defer: true };
    if (tool.name === Agent.SKILL_TOOL_NAME || !defers(deferred)) {
        return tool;
    }
    const lines = toolGuidelines(tool.name);
    if (!lines.length) {
        return deferred;
    }
    const guided = (description) => [description, ...lines].join(' ');
    const prompt = tool.prompt?.description
        ? { ...tool.prompt, description: guided(tool.prompt.description) }
        : tool.prompt;
    return { ...deferred, description: guided(tool.description), prompt };
}
export function toSdkTool(tool) {
    const sent = {
        type: 'function',
        name: tool.name,
        description: tool.prompt?.description ?? tool.description,
        parameters: sdkParameters(intentParameters(tool, tool.prompt?.parameters ?? tool.parameters))
    };
    const group = tool.group ?? tool.owningSkill ?? tool.toolset ?? undefined;
    return defers(tool) ? { ...sent, deferLoading: true, group } : sent;
}
export function toSdkTools(tools) {
    const searching = tools.some(defers);
    const sent = tools.filter((tool) => !searching || tool.name !== TOOL_SEARCH_NAME);
    return sent.length ? sent.map((tool) => toSdkTool(tool)) : undefined;
}
export function renderedTools(tools) {
    const deferred = tools?.filter((tool) => tool.deferLoading === true) ?? [];
    if (!tools || !deferred.length) {
        return tools;
    }
    return [...tools.filter((tool) => tool.deferLoading !== true), buildToolSearchTool(deferred)];
}
export function loadedTools(history) {
    return loadedToolNames(history.filter((entry) => !isFailureResultReference(entry)));
}
export function loadTurns(sent, names, history) {
    const turns = [];
    for (const name of new Set(names)) {
        const tool = sent?.find((each) => each.name === name && each.deferLoading === true);
        const seen = [...history, ...turns];
        if (tool && !loadedTools(seen).has(name)) {
            const messages = seen.filter((entry) => !isFailureResultReference(entry));
            const content = executeToolSearch([tool], { query: name, limit: 1 }, messages);
            turns.push({ role: 'tool', content });
        }
    }
    return turns;
}
export function skillLoadTurns(skill, { sent, enabled, history }) {
    const granted = new Set(skill?.tools.map((entry) => Agent.parseToolGrant(entry).name));
    const names = enabled.filter(({ name }) => granted.has(name)).map(({ name }) => name);
    return loadTurns(sent, names, history);
}
export function unloadedTools(tools, history) {
    const loaded = loadedTools(history);
    return new Set(tools.filter((tool) => defers(tool) && !loaded.has(tool.name)).map(({ name }) => name));
}
export function withToolSearch(tools) {
    if (!tools.some(defers)) {
        return tools;
    }
    if (tools.some((tool) => tool.name === TOOL_SEARCH_NAME)) {
        throw new Error(`No tool may be named ${TOOL_SEARCH_NAME} while tools defer: the SDK reserves it`);
    }
    const sent = toSdkTools(tools) ?? [];
    const search = buildToolSearchTool(sent.filter((tool) => tool.deferLoading === true));
    return [
        ...tools,
        {
            name: TOOL_SEARCH_NAME,
            description: search.description,
            parameters: {
                type: 'object',
                properties: Object.fromEntries(Object.entries(search.parameters.properties).map(([key, { type, description }]) => [
                    key,
                    { type: type ?? 'string', description }
                ])),
                required: search.parameters.required
            },
            toolset: null,
            autoApprove: true,
            concurrent: true,
            effect: () => 'read',
            execute: (args, ctx) => Promise.resolve(JSON.parse(executeToolSearch(sent, args, ctx?.history ?? [])))
        }
    ];
}
