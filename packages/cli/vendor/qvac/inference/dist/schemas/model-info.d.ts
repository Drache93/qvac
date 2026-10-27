import { z } from 'zod';
export declare const getModelInfoParamsSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export declare const getModelInfoRequestSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"getModelInfo">;
}, z.core.$strip>;
export declare const loadedInstanceSchema: z.ZodObject<{
    registryId: z.ZodString;
    loadedAt: z.ZodCoercedDate<unknown>;
    config: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const cacheFileInfoSchema: z.ZodObject<{
    filename: z.ZodString;
    path: z.ZodString;
    expectedSize: z.ZodNumber;
    sha256Checksum: z.ZodString;
    isCached: z.ZodBoolean;
    actualSize: z.ZodOptional<z.ZodNumber>;
    cachedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export declare const modelInfoSchema: z.ZodObject<{
    name: z.ZodString;
    modelId: z.ZodString;
    registryPath: z.ZodOptional<z.ZodString>;
    registrySource: z.ZodOptional<z.ZodString>;
    blobCoreKey: z.ZodOptional<z.ZodString>;
    blobBlockOffset: z.ZodOptional<z.ZodNumber>;
    blobBlockLength: z.ZodOptional<z.ZodNumber>;
    blobByteOffset: z.ZodOptional<z.ZodNumber>;
    engine: z.ZodOptional<z.ZodString>;
    quantization: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodString>;
    expectedSize: z.ZodNumber;
    sha256Checksum: z.ZodString;
    addon: z.ZodEnum<{
        embeddings: "embeddings";
        diffusion: "diffusion";
        audiogen: "audiogen";
        tts: "tts";
        ocr: "ocr";
        vla: "vla";
        "moss-transcribe": "moss-transcribe";
        llm: "llm";
        whisper: "whisper";
        bci: "bci";
        nmt: "nmt";
        parakeet: "parakeet";
        classification: "classification";
        vad: "vad";
        other: "other";
    }>;
    isCached: z.ZodBoolean;
    isLoaded: z.ZodBoolean;
    cacheFiles: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        path: z.ZodString;
        expectedSize: z.ZodNumber;
        sha256Checksum: z.ZodString;
        isCached: z.ZodBoolean;
        actualSize: z.ZodOptional<z.ZodNumber>;
        cachedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    }, z.core.$strip>>;
    actualSize: z.ZodOptional<z.ZodNumber>;
    cachedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    loadedInstances: z.ZodOptional<z.ZodArray<z.ZodObject<{
        registryId: z.ZodString;
        loadedAt: z.ZodCoercedDate<unknown>;
        config: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const getModelInfoResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"getModelInfo">;
    modelInfo: z.ZodObject<{
        name: z.ZodString;
        modelId: z.ZodString;
        registryPath: z.ZodOptional<z.ZodString>;
        registrySource: z.ZodOptional<z.ZodString>;
        blobCoreKey: z.ZodOptional<z.ZodString>;
        blobBlockOffset: z.ZodOptional<z.ZodNumber>;
        blobBlockLength: z.ZodOptional<z.ZodNumber>;
        blobByteOffset: z.ZodOptional<z.ZodNumber>;
        engine: z.ZodOptional<z.ZodString>;
        quantization: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodString>;
        expectedSize: z.ZodNumber;
        sha256Checksum: z.ZodString;
        addon: z.ZodEnum<{
            embeddings: "embeddings";
            diffusion: "diffusion";
            audiogen: "audiogen";
            tts: "tts";
            ocr: "ocr";
            vla: "vla";
            "moss-transcribe": "moss-transcribe";
            llm: "llm";
            whisper: "whisper";
            bci: "bci";
            nmt: "nmt";
            parakeet: "parakeet";
            classification: "classification";
            vad: "vad";
            other: "other";
        }>;
        isCached: z.ZodBoolean;
        isLoaded: z.ZodBoolean;
        cacheFiles: z.ZodArray<z.ZodObject<{
            filename: z.ZodString;
            path: z.ZodString;
            expectedSize: z.ZodNumber;
            sha256Checksum: z.ZodString;
            isCached: z.ZodBoolean;
            actualSize: z.ZodOptional<z.ZodNumber>;
            cachedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        }, z.core.$strip>>;
        actualSize: z.ZodOptional<z.ZodNumber>;
        cachedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        loadedInstances: z.ZodOptional<z.ZodArray<z.ZodObject<{
            registryId: z.ZodString;
            loadedAt: z.ZodCoercedDate<unknown>;
            config: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GetModelInfoParams = z.input<typeof getModelInfoParamsSchema>;
export type GetModelInfoRequest = z.infer<typeof getModelInfoRequestSchema>;
export type LoadedInstance = z.infer<typeof loadedInstanceSchema>;
export type CacheFileInfo = z.infer<typeof cacheFileInfoSchema>;
export type ModelInfo = z.infer<typeof modelInfoSchema>;
export type GetModelInfoResponse = z.infer<typeof getModelInfoResponseSchema>;
export declare const getLoadedModelInfoParamsSchema: z.ZodObject<{
    modelId: z.ZodString;
}, z.core.$strip>;
export declare const getLoadedModelInfoRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    type: z.ZodLiteral<"getLoadedModelInfo">;
}, z.core.$strip>;
/**
 * Loaded model info: routing plugin known on this node, so modelType +
 * handler vocabulary are authoritative. `toolDialect` is the tool-call dialect
 * the completion normalizer parses for this model (completion-capable models
 * only), letting a consumer replay a prior tool call in the model's own dialect.
 */
export declare const loadedModelInfoSchema: z.ZodObject<{
    modelId: z.ZodString;
    modelType: z.ZodString;
    handlers: z.ZodArray<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    addonPackage: z.ZodOptional<z.ZodString>;
    loadedAt: z.ZodCoercedDate<unknown>;
    name: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    toolDialect: z.ZodOptional<z.ZodEnum<{
        json: "json";
        hermes: "hermes";
        pythonic: "pythonic";
        harmony: "harmony";
        qwen35: "qwen35";
        gemma4: "gemma4";
        dsml: "dsml";
    }>>;
    fitProbe: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<{
            unknown: "unknown";
            fit: "fit";
            "does-not-fit": "does-not-fit";
        }>;
        basis: z.ZodLiteral<"native-probe">;
        engine: z.ZodOptional<z.ZodString>;
        estimatorVersion: z.ZodString;
        reason: z.ZodString;
        message: z.ZodOptional<z.ZodString>;
        plan: z.ZodOptional<z.ZodObject<{
            nCtx: z.ZodNumber;
            nGpuLayers: z.ZodNumber;
            nGpuDevices: z.ZodNumber;
        }, z.core.$strip>>;
        projection: z.ZodOptional<z.ZodObject<{
            deviceName: z.ZodOptional<z.ZodString>;
            deviceBytes: z.ZodOptional<z.ZodNumber>;
            hostBytes: z.ZodOptional<z.ZodNumber>;
            weightsBytes: z.ZodOptional<z.ZodNumber>;
            contextBytes: z.ZodOptional<z.ZodNumber>;
            computeBytes: z.ZodOptional<z.ZodNumber>;
            deviceFreeBytes: z.ZodOptional<z.ZodNumber>;
            deviceTotalBytes: z.ZodOptional<z.ZodNumber>;
            devices: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                totalBytes: z.ZodNumber;
                freeBytes: z.ZodNumber;
                weightsBytes: z.ZodNumber;
                contextBytes: z.ZodNumber;
                computeBytes: z.ZodNumber;
            }, z.core.$strip>>>;
            report: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const getLoadedModelInfoResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"getLoadedModelInfo">;
    info: z.ZodObject<{
        modelId: z.ZodString;
        modelType: z.ZodString;
        handlers: z.ZodArray<z.ZodString>;
        displayName: z.ZodOptional<z.ZodString>;
        addonPackage: z.ZodOptional<z.ZodString>;
        loadedAt: z.ZodCoercedDate<unknown>;
        name: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        toolDialect: z.ZodOptional<z.ZodEnum<{
            json: "json";
            hermes: "hermes";
            pythonic: "pythonic";
            harmony: "harmony";
            qwen35: "qwen35";
            gemma4: "gemma4";
            dsml: "dsml";
        }>>;
        fitProbe: z.ZodOptional<z.ZodObject<{
            verdict: z.ZodEnum<{
                unknown: "unknown";
                fit: "fit";
                "does-not-fit": "does-not-fit";
            }>;
            basis: z.ZodLiteral<"native-probe">;
            engine: z.ZodOptional<z.ZodString>;
            estimatorVersion: z.ZodString;
            reason: z.ZodString;
            message: z.ZodOptional<z.ZodString>;
            plan: z.ZodOptional<z.ZodObject<{
                nCtx: z.ZodNumber;
                nGpuLayers: z.ZodNumber;
                nGpuDevices: z.ZodNumber;
            }, z.core.$strip>>;
            projection: z.ZodOptional<z.ZodObject<{
                deviceName: z.ZodOptional<z.ZodString>;
                deviceBytes: z.ZodOptional<z.ZodNumber>;
                hostBytes: z.ZodOptional<z.ZodNumber>;
                weightsBytes: z.ZodOptional<z.ZodNumber>;
                contextBytes: z.ZodOptional<z.ZodNumber>;
                computeBytes: z.ZodOptional<z.ZodNumber>;
                deviceFreeBytes: z.ZodOptional<z.ZodNumber>;
                deviceTotalBytes: z.ZodOptional<z.ZodNumber>;
                devices: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    totalBytes: z.ZodNumber;
                    freeBytes: z.ZodNumber;
                    weightsBytes: z.ZodNumber;
                    contextBytes: z.ZodNumber;
                    computeBytes: z.ZodNumber;
                }, z.core.$strip>>>;
                report: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GetLoadedModelInfoParams = z.input<typeof getLoadedModelInfoParamsSchema>;
export type GetLoadedModelInfoRequest = z.infer<typeof getLoadedModelInfoRequestSchema>;
export type GetLoadedModelInfoResponse = z.infer<typeof getLoadedModelInfoResponseSchema>;
export type LoadedModelInfo = z.infer<typeof loadedModelInfoSchema>;
