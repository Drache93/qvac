import { Reranker } from '@qvac/embed-llamacpp';
import { type CreateModelParams } from '../../../schemas/index.js';
export declare const rerankPlugin: {
    modelType: "llamacpp-rerank";
    displayName: string;
    addonPackage: "@qvac/embed-llamacpp";
    loadConfigSchema: import("zod").ZodPipe<import("zod").ZodObject<{
        device: import("zod").ZodOptional<import("zod").ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>>;
        gpu_layers: import("zod").ZodOptional<import("zod").ZodNumber>;
        batch_size: import("zod").ZodOptional<import("zod").ZodNumber>;
        backend: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
            auto: "auto";
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
        }>>>;
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
        backend?: ("auto" | "cuda" | "vulkan" | "metal" | "opencl")[] | undefined;
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
        backend?: ("auto" | "cuda" | "vulkan" | "metal" | "opencl")[] | undefined;
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
        model: Reranker;
    };
    handlers: {
        rerank: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            query: import("zod").ZodString;
            documents: import("zod").ZodArray<import("zod").ZodString>;
            type: import("zod").ZodLiteral<"rerank">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
            modelId: import("zod").ZodString;
        }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"rerank">;
            scores: import("zod").ZodArray<import("zod").ZodNumber>;
        }, import("zod/v4/core").$strip>>;
    };
    logging: {
        module: () => Promise<typeof import("@qvac/embed-llamacpp/addonLogging")>;
        namespace: "llamacpp-embedding";
    };
};
