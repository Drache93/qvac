import { z } from 'zod';
import { toolSchema } from '../schemas/tools.js';
import { InvalidToolsArrayError, InvalidToolSchemaError } from '../errors/index.js';
// Zod's integer bounds; they add nothing a tool grammar needs.
const SAFE_INTEGER_BOUNDS = new Set([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
function dropSafeIntegerBounds(node) {
    if (Array.isArray(node))
        return node.map(dropSafeIntegerBounds);
    if (!node || typeof node !== 'object')
        return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if ((key === 'minimum' || key === 'maximum') && SAFE_INTEGER_BOUNDS.has(value)) {
            continue;
        }
        out[key] = dropSafeIntegerBounds(value);
    }
    return out;
}
function zodToToolParameters(schema) {
    const { $schema: _schema, ...json } = dropSafeIntegerBounds(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
    return { ...json, type: 'object', properties: json['properties'] ?? {} };
}
export function convertToolInput(input) {
    const tool = {
        type: 'function',
        name: input.name,
        description: input.description,
        ...(input.deferLoading !== undefined && { deferLoading: input.deferLoading }),
        ...(input.group !== undefined && { group: input.group }),
        parameters: zodToToolParameters(input.parameters)
    };
    return toolSchema.parse(tool);
}
export function convertTools(inputs) {
    return inputs.map(convertToolInput);
}
export function validateTools(tools) {
    if (tools.length === 0) {
        return { tools: [], handlers: new Map() };
    }
    const firstTool = tools[0];
    if (!firstTool) {
        throw new InvalidToolsArrayError();
    }
    const handlers = new Map();
    const parseResult = toolSchema.safeParse(firstTool);
    if (parseResult.success) {
        const validatedTools = [];
        for (const tool of tools) {
            const result = toolSchema.safeParse(tool);
            if (!result.success) {
                throw new InvalidToolSchemaError(result.error.message, result.error);
            }
            validatedTools.push(result.data);
        }
        return { tools: validatedTools, handlers };
    }
    else {
        const toolInputs = tools;
        const convertedTools = convertTools(toolInputs);
        for (const toolInput of toolInputs) {
            if (toolInput.handler) {
                handlers.set(toolInput.name, toolInput.handler);
            }
        }
        return { tools: convertedTools, handlers };
    }
}
export function attachHandlersToToolCalls(toolCalls, handlers) {
    return toolCalls.map((toolCall) => {
        const handler = handlers.get(toolCall.name);
        if (handler) {
            return {
                ...toolCall,
                invoke: async () => await handler(toolCall.arguments)
            };
        }
        return toolCall;
    });
}
