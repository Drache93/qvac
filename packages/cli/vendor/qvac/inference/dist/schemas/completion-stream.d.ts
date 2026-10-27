import { z } from 'zod';
export { completionStatsSchema, type CompletionStats } from './completion-event.js';
/**
 * Tool-call output dialect. Detected at load from the model name, then from the
 * GGUF `general.architecture`, then `"hermes"`; pass via
 * `completion({ toolDialect })` to override.
 *
 * Expected raw model output per dialect:
 * - `"hermes"`:   `<tool_call>{"name":"get_weather","arguments":{"city":"Tokyo"}}</tool_call>`
 * - `"pythonic"`: `[get_weather(city="Tokyo")]` (optionally `<|tool_call_start|>...<|tool_call_end|>`-wrapped)
 * - `"json"`:     `{"name":"get_weather","arguments":{"city":"Tokyo"}}` or `{"tool_calls":[{"name":"...","arguments":{...}}]}`
 * - `"harmony"`:  `<|channel|>commentary to=functions.get_weather <|constrain|>json<|message|>{"city":"Tokyo"}<|call|>`
 * - `"qwen35"`:   `<tool_call><function=NAME><parameter=KEY>VALUE</parameter></function></tool_call>`
 * - `"gemma4"`:   `<|tool_call>call:NAME{key:<|"|>val<|"|>,...}<tool_call|>`
 * - `"dsml"`:     `<｜DSML｜tool_calls><｜DSML｜invoke name="NAME"><｜DSML｜parameter name="KEY" string="true">VALUE</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>`
 *                 (DeepSeek Markup Language, emitted by DeepSeek V3.2 / V4)
 */
export declare const toolDialectSchema: z.ZodEnum<{
    json: "json";
    hermes: "hermes";
    pythonic: "pythonic";
    harmony: "harmony";
    qwen35: "qwen35";
    gemma4: "gemma4";
    dsml: "dsml";
}>;
export declare const attachmentSchema: z.ZodObject<{
    path: z.ZodString;
}, z.core.$strip>;
export declare const generationParamsSchema: z.ZodObject<{
    temp: z.ZodOptional<z.ZodNumber>;
    top_p: z.ZodOptional<z.ZodNumber>;
    top_k: z.ZodOptional<z.ZodNumber>;
    predict: z.ZodOptional<z.ZodNumber>;
    seed: z.ZodOptional<z.ZodNumber>;
    frequency_penalty: z.ZodOptional<z.ZodNumber>;
    presence_penalty: z.ZodOptional<z.ZodNumber>;
    repeat_penalty: z.ZodOptional<z.ZodNumber>;
    reasoning_budget: z.ZodOptional<z.ZodNumber>;
    tool_choice: z.ZodOptional<z.ZodString>;
    parallel_tool_calls: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
type ToolChoiceTool = {
    type: 'function';
    name: string;
    deferLoading?: boolean | undefined;
};
export declare function refineToolChoiceMatchesTools(data: {
    tools?: ToolChoiceTool[] | undefined;
    generationParams?: {
        tool_choice?: string | undefined;
    } | undefined;
}, ctx: z.RefinementCtx): void;
/**
 * `tool_search` is synthesised only when something defers, and would then
 * shadow a caller-declared tool of that name. Requests that defer nothing
 * keep the name free.
 */
export declare function refineReservedToolNames(data: {
    tools?: {
        name: string;
        deferLoading?: boolean | undefined;
    }[] | undefined;
}, ctx: z.RefinementCtx): void;
export declare const responseFormatSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"text">;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"json_object">;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"json_schema">;
    json_schema: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        strict: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>], "type">;
export declare const historyMessageSchema: z.ZodPipe<z.ZodObject<{
    role: z.ZodString;
    content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
    }, z.core.$strip>>>;
    toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>>;
    toolCallId: z.ZodOptional<z.ZodString>;
    toolName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodTransform<{
    content: string;
    role: string;
    attachments?: {
        path: string;
    }[] | undefined;
    toolCalls?: {
        name: string;
        arguments: Record<string, unknown>;
        id?: string | undefined;
    }[] | undefined;
    toolCallId?: string | undefined;
    toolName?: string | undefined;
}, {
    role: string;
    content?: string | null | undefined;
    attachments?: {
        path: string;
    }[] | undefined;
    toolCalls?: {
        name: string;
        arguments: Record<string, unknown>;
        id?: string | undefined;
    }[] | undefined;
    toolCallId?: string | undefined;
    toolName?: string | undefined;
}>>;
export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export declare const completionParamsSchema: z.ZodObject<{
    history: z.ZodArray<z.ZodPipe<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
        }, z.core.$strip>>>;
        toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>>;
        toolCallId: z.ZodOptional<z.ZodString>;
        toolName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodTransform<{
        content: string;
        role: string;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }, {
        role: string;
        content?: string | null | undefined;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }>>>;
    modelId: z.ZodString;
    kvCache: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
    prefill: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const completionClientParamsSchema: z.ZodObject<{
    history: z.ZodArray<z.ZodPipe<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
        }, z.core.$strip>>>;
        toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>>;
        toolCallId: z.ZodOptional<z.ZodString>;
        toolName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodTransform<{
        content: string;
        role: string;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }, {
        role: string;
        content?: string | null | undefined;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }>>>;
    modelId: z.ZodString;
    prefill: z.ZodOptional<z.ZodBoolean>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"function">;
        name: z.ZodString;
        description: z.ZodString;
        deferLoading: z.ZodOptional<z.ZodBoolean>;
        group: z.ZodOptional<z.ZodString>;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>, z.ZodArray<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>>]>>;
                description: z.ZodOptional<z.ZodString>;
                enum: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
            }, z.core.$loose>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>;
    }, z.core.$strip>>>;
    stream: z.ZodBoolean;
    kvCache: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
    generationParams: z.ZodOptional<z.ZodObject<{
        temp: z.ZodOptional<z.ZodNumber>;
        top_p: z.ZodOptional<z.ZodNumber>;
        top_k: z.ZodOptional<z.ZodNumber>;
        predict: z.ZodOptional<z.ZodNumber>;
        seed: z.ZodOptional<z.ZodNumber>;
        frequency_penalty: z.ZodOptional<z.ZodNumber>;
        presence_penalty: z.ZodOptional<z.ZodNumber>;
        repeat_penalty: z.ZodOptional<z.ZodNumber>;
        reasoning_budget: z.ZodOptional<z.ZodNumber>;
        tool_choice: z.ZodOptional<z.ZodString>;
        parallel_tool_calls: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    captureThinking: z.ZodOptional<z.ZodBoolean>;
    emitRawDeltas: z.ZodOptional<z.ZodBoolean>;
    toolDialect: z.ZodOptional<z.ZodEnum<{
        json: "json";
        hermes: "hermes";
        pythonic: "pythonic";
        harmony: "harmony";
        qwen35: "qwen35";
        gemma4: "gemma4";
        dsml: "dsml";
    }>>;
    responseFormat: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_object">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_schema">;
        json_schema: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const completionStreamRequestSchema: z.ZodObject<{
    history: z.ZodArray<z.ZodPipe<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
        }, z.core.$strip>>>;
        toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>>;
        toolCallId: z.ZodOptional<z.ZodString>;
        toolName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodTransform<{
        content: string;
        role: string;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }, {
        role: string;
        content?: string | null | undefined;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }>>>;
    modelId: z.ZodString;
    prefill: z.ZodOptional<z.ZodBoolean>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"function">;
        name: z.ZodString;
        description: z.ZodString;
        deferLoading: z.ZodOptional<z.ZodBoolean>;
        group: z.ZodOptional<z.ZodString>;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>, z.ZodArray<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>>]>>;
                description: z.ZodOptional<z.ZodString>;
                enum: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
            }, z.core.$loose>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>;
    }, z.core.$strip>>>;
    stream: z.ZodBoolean;
    kvCache: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
    generationParams: z.ZodOptional<z.ZodObject<{
        temp: z.ZodOptional<z.ZodNumber>;
        top_p: z.ZodOptional<z.ZodNumber>;
        top_k: z.ZodOptional<z.ZodNumber>;
        predict: z.ZodOptional<z.ZodNumber>;
        seed: z.ZodOptional<z.ZodNumber>;
        frequency_penalty: z.ZodOptional<z.ZodNumber>;
        presence_penalty: z.ZodOptional<z.ZodNumber>;
        repeat_penalty: z.ZodOptional<z.ZodNumber>;
        reasoning_budget: z.ZodOptional<z.ZodNumber>;
        tool_choice: z.ZodOptional<z.ZodString>;
        parallel_tool_calls: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    captureThinking: z.ZodOptional<z.ZodBoolean>;
    emitRawDeltas: z.ZodOptional<z.ZodBoolean>;
    toolDialect: z.ZodOptional<z.ZodEnum<{
        json: "json";
        hermes: "hermes";
        pythonic: "pythonic";
        harmony: "harmony";
        qwen35: "qwen35";
        gemma4: "gemma4";
        dsml: "dsml";
    }>>;
    responseFormat: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_object">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_schema">;
        json_schema: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    requestId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"completionStream">;
}, z.core.$strip>;
export declare const completionStreamResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"completionStream">;
    done: z.ZodOptional<z.ZodBoolean>;
    events: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"contentDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"rawDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"thinkingDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"toolCall">;
        seq: z.ZodNumber;
        call: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            raw: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"toolError">;
        seq: z.ZodNumber;
        error: z.ZodObject<{
            code: z.ZodEnum<{
                PARSE_ERROR: "PARSE_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                UNKNOWN_TOOL: "UNKNOWN_TOOL";
            }>;
            message: z.ZodString;
            raw: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"completionStats">;
        seq: z.ZodNumber;
        stats: z.ZodObject<{
            timeToFirstToken: z.ZodOptional<z.ZodNumber>;
            tokensPerSecond: z.ZodOptional<z.ZodNumber>;
            promptTokensPerSecond: z.ZodOptional<z.ZodNumber>;
            cacheTokens: z.ZodOptional<z.ZodNumber>;
            promptTokens: z.ZodOptional<z.ZodNumber>;
            generatedTokens: z.ZodOptional<z.ZodNumber>;
            emittedTokens: z.ZodOptional<z.ZodNumber>;
            avgConcurrentSeq: z.ZodOptional<z.ZodNumber>;
            toolDefinitionsDropped: z.ZodOptional<z.ZodNumber>;
            draftTokens: z.ZodOptional<z.ZodNumber>;
            draftAcceptedTokens: z.ZodOptional<z.ZodNumber>;
            backendDevice: z.ZodOptional<z.ZodEnum<{
                cpu: "cpu";
                gpu: "gpu";
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"completionDone">;
        seq: z.ZodNumber;
        stopReason: z.ZodLiteral<"error">;
        error: z.ZodObject<{
            message: z.ZodString;
        }, z.core.$strip>;
        raw: z.ZodOptional<z.ZodObject<{
            fullText: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"completionDone">;
        seq: z.ZodNumber;
        stopReason: z.ZodOptional<z.ZodEnum<{
            cancelled: "cancelled";
            length: "length";
            eos: "eos";
            stopSequence: "stopSequence";
        }>>;
        raw: z.ZodOptional<z.ZodObject<{
            fullText: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strict>]>>;
}, z.core.$strict>;
export declare const completionOrchestrateRequestSchema: z.ZodObject<{
    history: z.ZodArray<z.ZodPipe<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
        }, z.core.$strip>>>;
        toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>>;
        toolCallId: z.ZodOptional<z.ZodString>;
        toolName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodTransform<{
        content: string;
        role: string;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }, {
        role: string;
        content?: string | null | undefined;
        attachments?: {
            path: string;
        }[] | undefined;
        toolCalls?: {
            name: string;
            arguments: Record<string, unknown>;
            id?: string | undefined;
        }[] | undefined;
        toolCallId?: string | undefined;
        toolName?: string | undefined;
    }>>>;
    modelId: z.ZodString;
    prefill: z.ZodOptional<z.ZodBoolean>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"function">;
        name: z.ZodString;
        description: z.ZodString;
        deferLoading: z.ZodOptional<z.ZodBoolean>;
        group: z.ZodOptional<z.ZodString>;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>, z.ZodArray<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    object: "object";
                    null: "null";
                    array: "array";
                    integer: "integer";
                }>>]>>;
                description: z.ZodOptional<z.ZodString>;
                enum: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
            }, z.core.$loose>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>;
    }, z.core.$strip>>>;
    stream: z.ZodBoolean;
    kvCache: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
    generationParams: z.ZodOptional<z.ZodObject<{
        temp: z.ZodOptional<z.ZodNumber>;
        top_p: z.ZodOptional<z.ZodNumber>;
        top_k: z.ZodOptional<z.ZodNumber>;
        predict: z.ZodOptional<z.ZodNumber>;
        seed: z.ZodOptional<z.ZodNumber>;
        frequency_penalty: z.ZodOptional<z.ZodNumber>;
        presence_penalty: z.ZodOptional<z.ZodNumber>;
        repeat_penalty: z.ZodOptional<z.ZodNumber>;
        reasoning_budget: z.ZodOptional<z.ZodNumber>;
        tool_choice: z.ZodOptional<z.ZodString>;
        parallel_tool_calls: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    captureThinking: z.ZodOptional<z.ZodBoolean>;
    emitRawDeltas: z.ZodOptional<z.ZodBoolean>;
    toolDialect: z.ZodOptional<z.ZodEnum<{
        json: "json";
        hermes: "hermes";
        pythonic: "pythonic";
        harmony: "harmony";
        qwen35: "qwen35";
        gemma4: "gemma4";
        dsml: "dsml";
    }>>;
    responseFormat: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"text">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_object">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"json_schema">;
        json_schema: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    requestId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"completionOrchestrate">;
    maxToolTurns: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Downstream frame of the orchestrated completion duplex stream. Exactly one
 * payload field is set per frame:
 *
 * - `events` — pass-through of the inner completion turn's events (with
 *   `turn` identifying which generation pass they belong to).
 * - `toolCallback` — the worker is asking the CLIENT to run a tool. The
 *   client executes its registered handler and writes a JSON line
 *   (`toolCallbackResultSchema`) up the request stream. The worker blocks
 *   this run (not the socket) until the matching `callId` arrives.
 * - `done` — terminal frame; the loop ended (final answer produced, error,
 *   cancellation, or the `maxToolTurns` cap).
 */
export declare const completionOrchestrateResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"completionOrchestrate">;
    turn: z.ZodOptional<z.ZodNumber>;
    events: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"contentDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"rawDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"thinkingDelta">;
        seq: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"toolCall">;
        seq: z.ZodNumber;
        call: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            raw: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"toolError">;
        seq: z.ZodNumber;
        error: z.ZodObject<{
            code: z.ZodEnum<{
                PARSE_ERROR: "PARSE_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                UNKNOWN_TOOL: "UNKNOWN_TOOL";
            }>;
            message: z.ZodString;
            raw: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"completionStats">;
        seq: z.ZodNumber;
        stats: z.ZodObject<{
            timeToFirstToken: z.ZodOptional<z.ZodNumber>;
            tokensPerSecond: z.ZodOptional<z.ZodNumber>;
            promptTokensPerSecond: z.ZodOptional<z.ZodNumber>;
            cacheTokens: z.ZodOptional<z.ZodNumber>;
            promptTokens: z.ZodOptional<z.ZodNumber>;
            generatedTokens: z.ZodOptional<z.ZodNumber>;
            emittedTokens: z.ZodOptional<z.ZodNumber>;
            avgConcurrentSeq: z.ZodOptional<z.ZodNumber>;
            toolDefinitionsDropped: z.ZodOptional<z.ZodNumber>;
            draftTokens: z.ZodOptional<z.ZodNumber>;
            draftAcceptedTokens: z.ZodOptional<z.ZodNumber>;
            backendDevice: z.ZodOptional<z.ZodEnum<{
                cpu: "cpu";
                gpu: "gpu";
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"completionDone">;
        seq: z.ZodNumber;
        stopReason: z.ZodLiteral<"error">;
        error: z.ZodObject<{
            message: z.ZodString;
        }, z.core.$strip>;
        raw: z.ZodOptional<z.ZodObject<{
            fullText: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"completionDone">;
        seq: z.ZodNumber;
        stopReason: z.ZodOptional<z.ZodEnum<{
            cancelled: "cancelled";
            length: "length";
            eos: "eos";
            stopSequence: "stopSequence";
        }>>;
        raw: z.ZodOptional<z.ZodObject<{
            fullText: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strict>]>>>;
    toolCallback: z.ZodOptional<z.ZodObject<{
        callId: z.ZodString;
        name: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    done: z.ZodOptional<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodLiteral<"maxToolTurns">>;
}, z.core.$strict>;
/**
 * Upstream JSON line the client writes after running a tool callback.
 * Newline-delimited on the duplex request stream, after the initial request
 * payload. `error` reports a handler failure; the worker forwards it to the
 * model as the tool result so the loop can recover or finish.
 */
export declare const toolCallbackResultSchema: z.ZodObject<{
    callId: z.ZodString;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GenerationParams = z.infer<typeof generationParamsSchema>;
export type CompletionParams = z.infer<typeof completionParamsSchema>;
export type ToolDialect = z.infer<typeof toolDialectSchema>;
export type ResponseFormat = z.infer<typeof responseFormatSchema>;
export type CompletionClientParams = z.input<typeof completionClientParamsSchema>;
export type CompletionStreamRequest = z.infer<typeof completionStreamRequestSchema>;
export type CompletionStreamResponse = z.infer<typeof completionStreamResponseSchema>;
export type CompletionOrchestrateRequest = z.infer<typeof completionOrchestrateRequestSchema>;
export type CompletionOrchestrateResponse = z.infer<typeof completionOrchestrateResponseSchema>;
export type ToolCallbackResult = z.infer<typeof toolCallbackResultSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
