import { z } from 'zod';
export declare const rerankRequestBodySchema: z.ZodObject<{
    query: z.ZodString;
    documents: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const rerankParamsSchema: z.ZodObject<{
    query: z.ZodString;
    documents: z.ZodArray<z.ZodString>;
    modelId: z.ZodString;
}, z.core.$strict>;
export declare const rerankRequestSchema: z.ZodObject<{
    query: z.ZodString;
    documents: z.ZodArray<z.ZodString>;
    type: z.ZodLiteral<"rerank">;
    requestId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodString;
}, z.core.$strict>;
export declare const rerankScoresSchema: z.ZodArray<z.ZodNumber>;
export declare const rerankResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"rerank">;
    scores: z.ZodArray<z.ZodNumber>;
}, z.core.$strip>;
export declare const rerankConfigBaseSchema: z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
    }>>;
    gpu_layers: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    backend: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        auto: "auto";
        cuda: "cuda";
        vulkan: "vulkan";
        metal: "metal";
        opencl: "opencl";
    }>>>;
    poll: z.ZodOptional<z.ZodNumber>;
    pollBatch: z.ZodOptional<z.ZodNumber>;
    threads: z.ZodOptional<z.ZodNumber>;
    'threads-batch': z.ZodOptional<z.ZodNumber>;
    flash_attn: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        on: "on";
        off: "off";
    }>>;
    verbosity: z.ZodOptional<z.ZodNumber>;
    'main-gpu': z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodEnum<{
        integrated: "integrated";
        dedicated: "dedicated";
    }>]>>;
    'split-mode': z.ZodOptional<z.ZodEnum<{
        none: "none";
        layer: "layer";
    }>>;
    'tensor-split': z.ZodOptional<z.ZodString>;
    openclCacheDir: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type RerankConfigInput = z.infer<typeof rerankConfigBaseSchema>;
export declare const RERANK_CONFIG_DEFAULTS: {
    readonly device: "gpu";
};
export declare const rerankConfigSchema: z.ZodPipe<z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
    }>>;
    gpu_layers: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    backend: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        auto: "auto";
        cuda: "cuda";
        vulkan: "vulkan";
        metal: "metal";
        opencl: "opencl";
    }>>>;
    poll: z.ZodOptional<z.ZodNumber>;
    pollBatch: z.ZodOptional<z.ZodNumber>;
    threads: z.ZodOptional<z.ZodNumber>;
    'threads-batch': z.ZodOptional<z.ZodNumber>;
    flash_attn: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        on: "on";
        off: "off";
    }>>;
    verbosity: z.ZodOptional<z.ZodNumber>;
    'main-gpu': z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodEnum<{
        integrated: "integrated";
        dedicated: "dedicated";
    }>]>>;
    'split-mode': z.ZodOptional<z.ZodEnum<{
        none: "none";
        layer: "layer";
    }>>;
    'tensor-split': z.ZodOptional<z.ZodString>;
    openclCacheDir: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodTransform<{
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
export type RerankParams = z.infer<typeof rerankParamsSchema>;
export type RerankRequest = z.infer<typeof rerankRequestSchema>;
export type RerankScores = z.infer<typeof rerankScoresSchema>;
export type RerankResponse = z.infer<typeof rerankResponseSchema>;
export type RerankConfig = z.infer<typeof rerankConfigSchema>;
