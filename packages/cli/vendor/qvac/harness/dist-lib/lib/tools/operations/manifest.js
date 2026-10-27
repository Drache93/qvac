import { z } from 'zod';
import { BUILDER_NAMES } from './builders.js';
import { DECODER_NAMES } from './decoders.js';
const ParameterType = z.enum(['string', 'number', 'boolean', 'object', 'integer', 'array', 'null']);
const ParameterSchema = z.lazy(() => z.object({
    type: z.union([ParameterType, z.array(ParameterType).min(1)]),
    sensitive: z.literal(true).optional(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    items: ParameterSchema.optional(),
    properties: z.record(z.string(), ParameterSchema).optional(),
    required: z.array(z.string()).optional()
}));
const ParametersSchema = z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), ParameterSchema),
    required: z.array(z.string()).optional()
});
const HttpRequestSchema = z.object({
    transport: z.literal('http').optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    url: z.string().min(1),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    urlDefaults: z.record(z.string(), z.string()).optional(),
    builder: z.enum(BUILDER_NAMES)
});
const McpRequestSchema = z.object({
    transport: z.literal('mcp'),
    method: z.string().min(1),
    url: z.string().min(1),
    builder: z.enum(BUILDER_NAMES)
});
const RequestSchema = z.union([McpRequestSchema, HttpRequestSchema]);
const ResponseSchema = z.union([
    z.strictObject({ pick: z.array(z.string().min(1)).min(1) }),
    z.strictObject({ decode: z.enum(DECODER_NAMES) })
]);
const OperationSchema = z.object({
    tool: z.string().min(1),
    description: z.string().min(1),
    parameters: ParametersSchema,
    request: RequestSchema,
    response: ResponseSchema.optional()
});
const ManifestSchema = z.object({ operations: z.array(OperationSchema) });
export function parseOperationsManifest(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch {
        return null;
    }
    const parsed = ManifestSchema.safeParse(value);
    return parsed.success ? parsed.data.operations : null;
}
