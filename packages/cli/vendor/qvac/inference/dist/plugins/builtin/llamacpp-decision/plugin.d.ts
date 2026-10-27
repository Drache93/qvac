import { LayaDecisions } from '@qvac/embed-llamacpp';
import { type CreateModelParams } from '../../../schemas/index.js';
export declare const decisionPlugin: {
    modelType: "llamacpp-decision";
    displayName: string;
    addonPackage: "@qvac/embed-llamacpp";
    loadConfigSchema: import("zod").ZodPipe<import("zod").ZodObject<{
        device: import("zod").ZodOptional<import("zod").ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>>;
        gpu_layers: import("zod").ZodOptional<import("zod").ZodNumber>;
        batch_size: import("zod").ZodOptional<import("zod").ZodNumber>;
        poll: import("zod").ZodOptional<import("zod").ZodNumber>;
        pollBatch: import("zod").ZodOptional<import("zod").ZodNumber>;
        threads: import("zod").ZodOptional<import("zod").ZodNumber>;
        'threads-batch': import("zod").ZodOptional<import("zod").ZodNumber>;
        flash_attn: import("zod").ZodOptional<import("zod").ZodEnum<{
            auto: "auto";
            on: "on";
            off: "off";
        }>>;
        verbosity: import("zod").ZodOptional<import("zod").ZodNumber>;
        'main-gpu': import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodEnum<{
            integrated: "integrated";
            dedicated: "dedicated";
        }>]>>;
        'split-mode': import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            layer: "layer";
        }>>;
        'tensor-split': import("zod").ZodOptional<import("zod").ZodString>;
        openclCacheDir: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strict>, import("zod").ZodTransform<{
        device: "cpu" | "gpu";
        gpu_layers?: number | undefined;
        batch_size?: number | undefined;
        poll?: number | undefined;
        pollBatch?: number | undefined;
        threads?: number | undefined;
        'threads-batch'?: number | undefined;
        flash_attn?: "auto" | "on" | "off" | undefined;
        verbosity?: number | undefined;
        'main-gpu'?: number | "integrated" | "dedicated" | undefined;
        'split-mode'?: "none" | "layer" | undefined;
        'tensor-split'?: string | undefined;
        openclCacheDir?: string | undefined;
    }, {
        device?: "cpu" | "gpu" | undefined;
        gpu_layers?: number | undefined;
        batch_size?: number | undefined;
        poll?: number | undefined;
        pollBatch?: number | undefined;
        threads?: number | undefined;
        'threads-batch'?: number | undefined;
        flash_attn?: "auto" | "on" | "off" | undefined;
        verbosity?: number | undefined;
        'main-gpu'?: number | "integrated" | "dedicated" | undefined;
        'split-mode'?: "none" | "layer" | undefined;
        'tensor-split'?: string | undefined;
        openclCacheDir?: string | undefined;
    }>>;
    createModel: (params: CreateModelParams) => {
        model: LayaDecisions;
    };
    handlers: {
        decide: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodUnion<readonly [import("zod").ZodObject<{
            state: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
            questions: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"choice">;
                criteria: import("zod").ZodUnion<readonly [import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean]>>, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>]>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"score">;
                criteria: import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"noul">;
                criteria: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
                    true: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>;
                    false: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>;
                }, import("zod/v4/core").$strict>>>;
                labels: import("zod").ZodOptional<import("zod").ZodObject<{
                    false: import("zod").ZodString;
                    true: import("zod").ZodString;
                }, import("zod/v4/core").$strict>>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>], "type">>;
            maxLen: import("zod").ZodOptional<import("zod").ZodNumber>;
            headMaxLen: import("zod").ZodOptional<import("zod").ZodNumber>;
            type: import("zod").ZodLiteral<"decide">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
            modelId: import("zod").ZodString;
        }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
            states: import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>;
            questions: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"choice">;
                criteria: import("zod").ZodUnion<readonly [import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean]>>, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>]>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"score">;
                criteria: import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"noul">;
                criteria: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
                    true: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>;
                    false: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>>>;
                }, import("zod/v4/core").$strict>>>;
                labels: import("zod").ZodOptional<import("zod").ZodObject<{
                    false: import("zod").ZodString;
                    true: import("zod").ZodString;
                }, import("zod/v4/core").$strict>>;
                instructions: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>, import("zod").ZodArray<import("zod").ZodUnknown>]>;
                optionOrder: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber>>;
            }, import("zod/v4/core").$strict>], "type">>;
            maxLen: import("zod").ZodOptional<import("zod").ZodNumber>;
            headMaxLen: import("zod").ZodOptional<import("zod").ZodNumber>;
            type: import("zod").ZodLiteral<"decide">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
            modelId: import("zod").ZodString;
        }, import("zod/v4/core").$strict>]>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"decide">;
            result: import("zod").ZodUnion<readonly [import("zod").ZodObject<{
                model: import("zod").ZodString;
                answers: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"choice">;
                    choice: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean]>;
                    probabilities: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"score">;
                    score: import("zod").ZodNumber;
                    legend: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodString>;
                    probabilities: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"noul">;
                    noul: import("zod").ZodNumber;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>], "type">>;
                usage: import("zod").ZodObject<{
                    inputTokens: import("zod").ZodNumber;
                    outputTokens: import("zod").ZodNumber;
                    stateTokens: import("zod").ZodNumber;
                    stateTokensDropped: import("zod").ZodNumber;
                    truncated: import("zod").ZodBoolean;
                    truncatedQuestions: import("zod").ZodArray<import("zod").ZodString>;
                    options: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                        total: import("zod").ZodNumber;
                        distinct: import("zod").ZodNumber;
                        tokensPerOption: import("zod").ZodNullable<import("zod").ZodNumber>;
                    }, import("zod/v4/core").$strip>>>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>, import("zod").ZodArray<import("zod").ZodObject<{
                model: import("zod").ZodString;
                answers: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"choice">;
                    choice: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean]>;
                    probabilities: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"score">;
                    score: import("zod").ZodNumber;
                    legend: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodString>;
                    probabilities: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"noul">;
                    noul: import("zod").ZodNumber;
                    answerConfidence: import("zod").ZodNumber;
                    confidence: import("zod").ZodNumber;
                    action: import("zod").ZodObject<{
                        actProbability: import("zod").ZodNumber;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>], "type">>;
                usage: import("zod").ZodObject<{
                    inputTokens: import("zod").ZodNumber;
                    outputTokens: import("zod").ZodNumber;
                    stateTokens: import("zod").ZodNumber;
                    stateTokensDropped: import("zod").ZodNumber;
                    truncated: import("zod").ZodBoolean;
                    truncatedQuestions: import("zod").ZodArray<import("zod").ZodString>;
                    options: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                        total: import("zod").ZodNumber;
                        distinct: import("zod").ZodNumber;
                        tokensPerOption: import("zod").ZodNullable<import("zod").ZodNumber>;
                    }, import("zod/v4/core").$strip>>>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>>]>;
        }, import("zod/v4/core").$strip>>;
    };
    logging: {
        module: () => Promise<typeof import("@qvac/embed-llamacpp/addonLogging")>;
        namespace: "llamacpp-embedding";
    };
};
