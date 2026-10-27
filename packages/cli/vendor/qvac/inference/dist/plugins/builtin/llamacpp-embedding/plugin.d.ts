import { assessFit as embedAssessFit } from '@qvac/embed-llamacpp';
import type { TurboVecIndexProvider } from '@qvac/rag';
import { type CreateModelParams, type PluginModelResult } from '../../../schemas/index.js';
export declare const embeddingsPlugin: {
    modelType: "llamacpp-embedding";
    displayName: string;
    addonPackage: "@qvac/embed-llamacpp";
    loadConfigSchema: import("zod").ZodObject<{
        poll: import("zod").ZodOptional<import("zod").ZodNumber>;
        pollBatch: import("zod").ZodOptional<import("zod").ZodNumber>;
        backend: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
            auto: "auto";
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
        }>>>;
        gpuLayers: import("zod").ZodOptional<import("zod").ZodNumber>;
        device: import("zod").ZodOptional<import("zod").ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>>;
        batchSize: import("zod").ZodOptional<import("zod").ZodNumber>;
        pooling: import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            mean: "mean";
            cls: "cls";
            last: "last";
        }>>;
        attention: import("zod").ZodOptional<import("zod").ZodEnum<{
            causal: "causal";
            "non-causal": "non-causal";
        }>>;
        embdNormalize: import("zod").ZodOptional<import("zod").ZodNumber>;
        flashAttention: import("zod").ZodOptional<import("zod").ZodEnum<{
            auto: "auto";
            on: "on";
            off: "off";
        }>>;
        mainGpu: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodEnum<{
            integrated: "integrated";
            dedicated: "dedicated";
        }>]>>;
        splitMode: import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            layer: "layer";
        }>>;
        tensorSplit: import("zod").ZodOptional<import("zod").ZodString>;
        verbosity: import("zod").ZodOptional<import("zod").ZodEnum<{
            readonly ERROR: 0;
            readonly WARN: 1;
            readonly INFO: 2;
            readonly DEBUG: 3;
        }>>;
        openclCacheDir: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strip>;
    assessFit: typeof embedAssessFit;
    createModel(params: CreateModelParams): PluginModelResult;
    handlers: {
        embed: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            text: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>]>;
            type: import("zod").ZodLiteral<"embed">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"embed">;
            success: import("zod").ZodBoolean;
            embedding: import("zod").ZodDefault<import("zod").ZodUnion<readonly [import("zod").ZodArray<import("zod").ZodNumber>, import("zod").ZodArray<import("zod").ZodArray<import("zod").ZodNumber>>]>>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                totalTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                    cpu: "cpu";
                    gpu: "gpu";
                }>>;
                contextSize: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            error: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>>;
    };
    capabilities: {
        turbovecIndexProvider: TurboVecIndexProvider;
    };
    logging: {
        module: () => Promise<typeof import("@qvac/embed-llamacpp/addonLogging")>;
        namespace: "llamacpp-embedding";
    };
};
