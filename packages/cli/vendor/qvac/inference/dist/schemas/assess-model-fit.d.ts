import { z } from 'zod';
export declare const transcriptionFitWorkloadSchema: z.ZodObject<{
    prompt: z.ZodOptional<z.ZodString>;
    hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxNewTokens: z.ZodOptional<z.ZodNumber>;
    audioSeconds: z.ZodNumber;
}, z.core.$strict>;
export type TranscriptionFitWorkload = z.infer<typeof transcriptionFitWorkloadSchema>;
/**
 * Advisory outcome of a pre-download fit assessment.
 *
 * `unknown` is a first-class answer, not a failure: it is what the SDK returns
 * whenever the evidence does not support a defensible claim either way.
 */
export declare const modelFitVerdictSchema: z.ZodEnum<{
    unknown: "unknown";
    "likely-fits": "likely-fits";
    "likely-too-large": "likely-too-large";
}>;
/**
 * What the estimator sizes a load by, read out of its config. An engine whose
 * estimator declares no kind for it assesses as `unknown`.
 */
export type ModelFitWorkload = {
    kind: 'llm';
    contextTokens?: number;
} | {
    kind: 'audio';
    windowMs?: number;
    streaming: boolean;
};
/**
 * The part of a model constant an assessment reads. Pass a catalog constant
 * directly — the extra fields are ignored.
 *
 * Only the checksum (the profile lookup key) and the name (the result label)
 * are read; everything else — engine, byte totals, transformer facts — comes
 * from the resolved resource profile, not from the caller.
 */
export declare const modelFitModelRefSchema: z.ZodObject<{
    sha256Checksum: z.ZodString;
    name: z.ZodString;
    registryPath: z.ZodOptional<z.ZodString>;
    registrySource: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * What the estimator is given for one candidate: the catalog facts its checksum
 * resolves to, and the workload read out of the load's config.
 */
export interface ModelFitEstimateTarget {
    model: ModelFitModelRef;
    workload: ModelFitWorkload;
    artifacts?: ModelFitModelRef[];
    device?: string;
}
/**
 * How the caller intends to run the candidates. This is a **declared
 * assumption** used for aggregation, not a scheduling instruction — the SDK
 * neither enforces nor reserves anything.
 *
 * - `sequential`: every model stays resident, but only the largest single
 *   working-memory peak is counted.
 * - `concurrent`: every model stays resident and every peak is counted.
 */
export declare const modelFitExecutionSchema: z.ZodEnum<{
    sequential: "sequential";
    concurrent: "concurrent";
}>;
/** Fit-only workload used to estimate MOSS text-to-speech memory requirements. */
export declare const ttsFitWorkloadSchema: z.ZodUnion<readonly [z.ZodObject<{
    promptRows: z.ZodNumber;
    referenceSamples: z.ZodNumber;
    streaming: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    prompt: z.ZodString;
    seconds: z.ZodNumber;
}, z.core.$strict>]>;
export type TtsFitWorkload = z.infer<typeof ttsFitWorkloadSchema>;
/**
 * A load to assess, in `loadModel`'s own parameters. The engine's plugin
 * resolves it, so the config and the artifact keys the fitter reads are the
 * ones the load would run with.
 *
 * Each source resolves to the registry's weightless description of the
 * artifact, or to the file itself where it is already on disk.
 */
export declare const modelFitCandidateSchema: z.ZodObject<{
    transcriptionWorkload: z.ZodOptional<z.ZodObject<{
        prompt: z.ZodOptional<z.ZodString>;
        hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxNewTokens: z.ZodOptional<z.ZodNumber>;
        audioSeconds: z.ZodNumber;
    }, z.core.$strict>>;
    modelSrc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        src: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        modelId: z.ZodOptional<z.ZodString>;
        registryPath: z.ZodOptional<z.ZodString>;
        registrySource: z.ZodOptional<z.ZodString>;
        blobCoreKey: z.ZodOptional<z.ZodString>;
        blobIndex: z.ZodOptional<z.ZodNumber>;
        engine: z.ZodOptional<z.ZodString>;
        expectedSize: z.ZodOptional<z.ZodNumber>;
        sha256Checksum: z.ZodOptional<z.ZodString>;
        addon: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            embeddings: "embeddings";
            diffusion: "diffusion";
            audiogen: "audiogen";
            tts: "tts";
            ocr: "ocr";
            vla: "vla";
            "llamacpp-completion": "llamacpp-completion";
            "whispercpp-transcription": "whispercpp-transcription";
            "bci-whispercpp-transcription": "bci-whispercpp-transcription";
            "llamacpp-embedding": "llamacpp-embedding";
            "llamacpp-decision": "llamacpp-decision";
            "llamacpp-rerank": "llamacpp-rerank";
            "nmtcpp-translation": "nmtcpp-translation";
            "onnx-tts": "onnx-tts";
            "tts-ggml": "tts-ggml";
            "parakeet-transcription": "parakeet-transcription";
            "moss-transcribe": "moss-transcribe";
            "ggml-ocr": "ggml-ocr";
            "sdcpp-generation": "sdcpp-generation";
            "audiogen-ggml": "audiogen-ggml";
            "ggml-vla": "ggml-vla";
            "ggml-classification": "ggml-classification";
            llm: "llm";
            whisper: "whisper";
            bci: "bci";
            nmt: "nmt";
            parakeet: "parakeet";
            classification: "classification";
        }>, z.ZodLiteral<"vad">]>>;
    }, z.core.$strip>]>>;
    modelType: z.ZodOptional<z.ZodEnum<{
        embeddings: "embeddings";
        diffusion: "diffusion";
        audiogen: "audiogen";
        tts: "tts";
        ocr: "ocr";
        vla: "vla";
        "llamacpp-completion": "llamacpp-completion";
        "whispercpp-transcription": "whispercpp-transcription";
        "bci-whispercpp-transcription": "bci-whispercpp-transcription";
        "llamacpp-embedding": "llamacpp-embedding";
        "llamacpp-decision": "llamacpp-decision";
        "llamacpp-rerank": "llamacpp-rerank";
        "nmtcpp-translation": "nmtcpp-translation";
        "onnx-tts": "onnx-tts";
        "tts-ggml": "tts-ggml";
        "parakeet-transcription": "parakeet-transcription";
        "moss-transcribe": "moss-transcribe";
        "ggml-ocr": "ggml-ocr";
        "sdcpp-generation": "sdcpp-generation";
        "audiogen-ggml": "audiogen-ggml";
        "ggml-vla": "ggml-vla";
        "ggml-classification": "ggml-classification";
        llm: "llm";
        whisper: "whisper";
        bci: "bci";
        nmt: "nmt";
        parakeet: "parakeet";
        classification: "classification";
    }>>;
    ttsWorkload: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        promptRows: z.ZodNumber;
        referenceSamples: z.ZodNumber;
        streaming: z.ZodBoolean;
    }, z.core.$strict>, z.ZodObject<{
        prompt: z.ZodString;
        seconds: z.ZodNumber;
    }, z.core.$strict>]>>;
    modelConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const assessModelFitInputSchema: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        transcriptionWorkload: z.ZodOptional<z.ZodObject<{
            prompt: z.ZodOptional<z.ZodString>;
            hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
            maxNewTokens: z.ZodOptional<z.ZodNumber>;
            audioSeconds: z.ZodNumber;
        }, z.core.$strict>>;
        modelSrc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            src: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            modelId: z.ZodOptional<z.ZodString>;
            registryPath: z.ZodOptional<z.ZodString>;
            registrySource: z.ZodOptional<z.ZodString>;
            blobCoreKey: z.ZodOptional<z.ZodString>;
            blobIndex: z.ZodOptional<z.ZodNumber>;
            engine: z.ZodOptional<z.ZodString>;
            expectedSize: z.ZodOptional<z.ZodNumber>;
            sha256Checksum: z.ZodOptional<z.ZodString>;
            addon: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                embeddings: "embeddings";
                diffusion: "diffusion";
                audiogen: "audiogen";
                tts: "tts";
                ocr: "ocr";
                vla: "vla";
                "llamacpp-completion": "llamacpp-completion";
                "whispercpp-transcription": "whispercpp-transcription";
                "bci-whispercpp-transcription": "bci-whispercpp-transcription";
                "llamacpp-embedding": "llamacpp-embedding";
                "llamacpp-decision": "llamacpp-decision";
                "llamacpp-rerank": "llamacpp-rerank";
                "nmtcpp-translation": "nmtcpp-translation";
                "onnx-tts": "onnx-tts";
                "tts-ggml": "tts-ggml";
                "parakeet-transcription": "parakeet-transcription";
                "moss-transcribe": "moss-transcribe";
                "ggml-ocr": "ggml-ocr";
                "sdcpp-generation": "sdcpp-generation";
                "audiogen-ggml": "audiogen-ggml";
                "ggml-vla": "ggml-vla";
                "ggml-classification": "ggml-classification";
                llm: "llm";
                whisper: "whisper";
                bci: "bci";
                nmt: "nmt";
                parakeet: "parakeet";
                classification: "classification";
            }>, z.ZodLiteral<"vad">]>>;
        }, z.core.$strip>]>>;
        modelType: z.ZodOptional<z.ZodEnum<{
            embeddings: "embeddings";
            diffusion: "diffusion";
            audiogen: "audiogen";
            tts: "tts";
            ocr: "ocr";
            vla: "vla";
            "llamacpp-completion": "llamacpp-completion";
            "whispercpp-transcription": "whispercpp-transcription";
            "bci-whispercpp-transcription": "bci-whispercpp-transcription";
            "llamacpp-embedding": "llamacpp-embedding";
            "llamacpp-decision": "llamacpp-decision";
            "llamacpp-rerank": "llamacpp-rerank";
            "nmtcpp-translation": "nmtcpp-translation";
            "onnx-tts": "onnx-tts";
            "tts-ggml": "tts-ggml";
            "parakeet-transcription": "parakeet-transcription";
            "moss-transcribe": "moss-transcribe";
            "ggml-ocr": "ggml-ocr";
            "sdcpp-generation": "sdcpp-generation";
            "audiogen-ggml": "audiogen-ggml";
            "ggml-vla": "ggml-vla";
            "ggml-classification": "ggml-classification";
            llm: "llm";
            whisper: "whisper";
            bci: "bci";
            nmt: "nmt";
            parakeet: "parakeet";
            classification: "classification";
        }>>;
        ttsWorkload: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            promptRows: z.ZodNumber;
            referenceSamples: z.ZodNumber;
            streaming: z.ZodBoolean;
        }, z.core.$strict>, z.ZodObject<{
            prompt: z.ZodString;
            seconds: z.ZodNumber;
        }, z.core.$strict>]>>;
        modelConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    execution: z.ZodDefault<z.ZodEnum<{
        sequential: "sequential";
        concurrent: "concurrent";
    }>>;
    policy: z.ZodDefault<z.ZodLiteral<"interactive-v1">>;
}, z.core.$strip>;
/**
 * What evidence the budget was derived from.
 *
 * - `system-memory`: total system RAM minus current use. The desktop model,
 *   and Android's — the low-memory killer acts system-wide.
 * - `process-memory`: this process's own ceiling. iOS jetsam terminates an app
 *   on its per-process footprint against a limit well below device RAM, so a
 *   system-wide budget there would defend verdicts the OS does not honor.
 */
export declare const modelFitBasisSchema: z.ZodEnum<{
    "system-memory": "system-memory";
    "process-memory": "process-memory";
    "device-memory": "device-memory";
    "device-budget": "device-budget";
}>;
/**
 * What kind of evidence a verdict rests on.
 *
 * - `native-fit`: the engine's own fitter, run against the model or the
 *   registry's weightless description of it. It is the answer the loader would
 *   give on this machine, and the only evidence that can confirm a fit.
 * - `computed-only`: a floor computed from catalog facts alone — artifact bytes,
 *   plus the KV cache for llama.cpp models. It omits every engine cost that
 *   only a real load can tell, so it can refuse a model but never confirm one.
 */
export declare const modelFitEvidenceSchema: z.ZodEnum<{
    "computed-only": "computed-only";
    "native-fit": "native-fit";
}>;
export declare const modelFitBudgetSchema: z.ZodObject<{
    totalBytes: z.ZodNumber;
    usedBytes: z.ZodNumber;
    availableBytes: z.ZodNumber;
    reservedBytes: z.ZodNumber;
    availableAfterReserveBytes: z.ZodNumber;
}, z.core.$strip>;
export declare const modelFitModelResultSchema: z.ZodObject<{
    name: z.ZodString;
    verdict: z.ZodEnum<{
        unknown: "unknown";
        "likely-fits": "likely-fits";
        "likely-too-large": "likely-too-large";
    }>;
    evidence: z.ZodOptional<z.ZodEnum<{
        "computed-only": "computed-only";
        "native-fit": "native-fit";
    }>>;
    floorBytes: z.ZodOptional<z.ZodNumber>;
    estimatorVersion: z.ZodOptional<z.ZodString>;
    device: z.ZodOptional<z.ZodString>;
    reasons: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const assessModelFitResultSchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        unknown: "unknown";
        "likely-fits": "likely-fits";
        "likely-too-large": "likely-too-large";
    }>;
    basis: z.ZodEnum<{
        "system-memory": "system-memory";
        "process-memory": "process-memory";
        "device-memory": "device-memory";
        "device-budget": "device-budget";
    }>;
    execution: z.ZodEnum<{
        sequential: "sequential";
        concurrent: "concurrent";
    }>;
    evidence: z.ZodOptional<z.ZodEnum<{
        "computed-only": "computed-only";
        "native-fit": "native-fit";
    }>>;
    budget: z.ZodOptional<z.ZodObject<{
        totalBytes: z.ZodNumber;
        usedBytes: z.ZodNumber;
        availableBytes: z.ZodNumber;
        reservedBytes: z.ZodNumber;
        availableAfterReserveBytes: z.ZodNumber;
    }, z.core.$strip>>;
    floorBytes: z.ZodOptional<z.ZodNumber>;
    models: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        verdict: z.ZodEnum<{
            unknown: "unknown";
            "likely-fits": "likely-fits";
            "likely-too-large": "likely-too-large";
        }>;
        evidence: z.ZodOptional<z.ZodEnum<{
            "computed-only": "computed-only";
            "native-fit": "native-fit";
        }>>;
        floorBytes: z.ZodOptional<z.ZodNumber>;
        estimatorVersion: z.ZodOptional<z.ZodString>;
        device: z.ZodOptional<z.ZodString>;
        reasons: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    reasons: z.ZodArray<z.ZodString>;
    assumptions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/**
 * The other fit question: `assessModelFit` above answers "should I download
 * this?" about a set of models against a memory budget, while the native probe
 * answers "will the load I am about to run fit?" by handing one model file and
 * the resolved settings to the fitter of the engine that would run it. Two
 * scopes, so two verdict vocabularies:
 *
 * - `likely-fits` / `likely-too-large` hedge because the set is judged against a
 *   sampled budget that the rest of the machine moves.
 * - `fit` / `does-not-fit` do not, because the probe measured this build of this
 *   file against this device.
 *
 * Neither denies a load.
 */
export declare const nativeProbeVerdictSchema: z.ZodEnum<{
    unknown: "unknown";
    fit: "fit";
    "does-not-fit": "does-not-fit";
}>;
export declare const nativeProbePlanSchema: z.ZodObject<{
    nCtx: z.ZodNumber;
    nGpuLayers: z.ZodNumber;
    nGpuDevices: z.ZodNumber;
}, z.core.$strip>;
/**
 * What the fitter measured. Each field is optional because the engines do not
 * all measure the same things: the diffusion fitter answers with a placement
 * and a per-module table rather than a total, so it fills `report` alone.
 *
 * `weightsBytes`, `contextBytes` and `computeBytes` divide `deviceBytes` where
 * the engine separates them, and are absent together where it reports only a
 * total. They are summed across devices, as `deviceBytes` is, so a load spread
 * over more than one device is described by its totals and `deviceName` names
 * the first non-CPU row.
 *
 * `deviceFreeBytes` is the backend's own gauge. A device sharing the host pool,
 * as Apple silicon and Adreno/Mali do, reports what it could address rather
 * than what the machine would give back, so it is an upper bound there.
 */
export declare const nativeProbeProjectionSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const nativeProbeFitSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const assessModelFitRequestSchema: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        transcriptionWorkload: z.ZodOptional<z.ZodObject<{
            prompt: z.ZodOptional<z.ZodString>;
            hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
            maxNewTokens: z.ZodOptional<z.ZodNumber>;
            audioSeconds: z.ZodNumber;
        }, z.core.$strict>>;
        modelSrc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            src: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            modelId: z.ZodOptional<z.ZodString>;
            registryPath: z.ZodOptional<z.ZodString>;
            registrySource: z.ZodOptional<z.ZodString>;
            blobCoreKey: z.ZodOptional<z.ZodString>;
            blobIndex: z.ZodOptional<z.ZodNumber>;
            engine: z.ZodOptional<z.ZodString>;
            expectedSize: z.ZodOptional<z.ZodNumber>;
            sha256Checksum: z.ZodOptional<z.ZodString>;
            addon: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                embeddings: "embeddings";
                diffusion: "diffusion";
                audiogen: "audiogen";
                tts: "tts";
                ocr: "ocr";
                vla: "vla";
                "llamacpp-completion": "llamacpp-completion";
                "whispercpp-transcription": "whispercpp-transcription";
                "bci-whispercpp-transcription": "bci-whispercpp-transcription";
                "llamacpp-embedding": "llamacpp-embedding";
                "llamacpp-decision": "llamacpp-decision";
                "llamacpp-rerank": "llamacpp-rerank";
                "nmtcpp-translation": "nmtcpp-translation";
                "onnx-tts": "onnx-tts";
                "tts-ggml": "tts-ggml";
                "parakeet-transcription": "parakeet-transcription";
                "moss-transcribe": "moss-transcribe";
                "ggml-ocr": "ggml-ocr";
                "sdcpp-generation": "sdcpp-generation";
                "audiogen-ggml": "audiogen-ggml";
                "ggml-vla": "ggml-vla";
                "ggml-classification": "ggml-classification";
                llm: "llm";
                whisper: "whisper";
                bci: "bci";
                nmt: "nmt";
                parakeet: "parakeet";
                classification: "classification";
            }>, z.ZodLiteral<"vad">]>>;
        }, z.core.$strip>]>>;
        modelType: z.ZodOptional<z.ZodEnum<{
            embeddings: "embeddings";
            diffusion: "diffusion";
            audiogen: "audiogen";
            tts: "tts";
            ocr: "ocr";
            vla: "vla";
            "llamacpp-completion": "llamacpp-completion";
            "whispercpp-transcription": "whispercpp-transcription";
            "bci-whispercpp-transcription": "bci-whispercpp-transcription";
            "llamacpp-embedding": "llamacpp-embedding";
            "llamacpp-decision": "llamacpp-decision";
            "llamacpp-rerank": "llamacpp-rerank";
            "nmtcpp-translation": "nmtcpp-translation";
            "onnx-tts": "onnx-tts";
            "tts-ggml": "tts-ggml";
            "parakeet-transcription": "parakeet-transcription";
            "moss-transcribe": "moss-transcribe";
            "ggml-ocr": "ggml-ocr";
            "sdcpp-generation": "sdcpp-generation";
            "audiogen-ggml": "audiogen-ggml";
            "ggml-vla": "ggml-vla";
            "ggml-classification": "ggml-classification";
            llm: "llm";
            whisper: "whisper";
            bci: "bci";
            nmt: "nmt";
            parakeet: "parakeet";
            classification: "classification";
        }>>;
        ttsWorkload: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            promptRows: z.ZodNumber;
            referenceSamples: z.ZodNumber;
            streaming: z.ZodBoolean;
        }, z.core.$strict>, z.ZodObject<{
            prompt: z.ZodString;
            seconds: z.ZodNumber;
        }, z.core.$strict>]>>;
        modelConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    execution: z.ZodDefault<z.ZodEnum<{
        sequential: "sequential";
        concurrent: "concurrent";
    }>>;
    policy: z.ZodDefault<z.ZodLiteral<"interactive-v1">>;
    type: z.ZodLiteral<"assessModelFit">;
}, z.core.$strip>;
export declare const assessModelFitResponseSchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        unknown: "unknown";
        "likely-fits": "likely-fits";
        "likely-too-large": "likely-too-large";
    }>;
    basis: z.ZodEnum<{
        "system-memory": "system-memory";
        "process-memory": "process-memory";
        "device-memory": "device-memory";
        "device-budget": "device-budget";
    }>;
    execution: z.ZodEnum<{
        sequential: "sequential";
        concurrent: "concurrent";
    }>;
    evidence: z.ZodOptional<z.ZodEnum<{
        "computed-only": "computed-only";
        "native-fit": "native-fit";
    }>>;
    budget: z.ZodOptional<z.ZodObject<{
        totalBytes: z.ZodNumber;
        usedBytes: z.ZodNumber;
        availableBytes: z.ZodNumber;
        reservedBytes: z.ZodNumber;
        availableAfterReserveBytes: z.ZodNumber;
    }, z.core.$strip>>;
    floorBytes: z.ZodOptional<z.ZodNumber>;
    models: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        verdict: z.ZodEnum<{
            unknown: "unknown";
            "likely-fits": "likely-fits";
            "likely-too-large": "likely-too-large";
        }>;
        evidence: z.ZodOptional<z.ZodEnum<{
            "computed-only": "computed-only";
            "native-fit": "native-fit";
        }>>;
        floorBytes: z.ZodOptional<z.ZodNumber>;
        estimatorVersion: z.ZodOptional<z.ZodString>;
        device: z.ZodOptional<z.ZodString>;
        reasons: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    reasons: z.ZodArray<z.ZodString>;
    assumptions: z.ZodArray<z.ZodString>;
    type: z.ZodLiteral<"assessModelFit">;
}, z.core.$strip>;
export type NativeProbeVerdict = z.infer<typeof nativeProbeVerdictSchema>;
export type NativeProbePlan = z.infer<typeof nativeProbePlanSchema>;
export type NativeProbeProjection = z.infer<typeof nativeProbeProjectionSchema>;
export type NativeProbeFit = z.infer<typeof nativeProbeFitSchema>;
export type ModelFitVerdict = z.infer<typeof modelFitVerdictSchema>;
export type ModelFitModelRef = z.infer<typeof modelFitModelRefSchema>;
export type ModelFitCandidate = z.infer<typeof modelFitCandidateSchema>;
export type ModelFitExecution = z.infer<typeof modelFitExecutionSchema>;
export type ModelFitBasis = z.infer<typeof modelFitBasisSchema>;
export type ModelFitEvidence = z.infer<typeof modelFitEvidenceSchema>;
export type ModelFitBudget = z.infer<typeof modelFitBudgetSchema>;
export type ModelFitModelResult = z.infer<typeof modelFitModelResultSchema>;
export type AssessModelFitInput = z.input<typeof assessModelFitInputSchema>;
export type AssessModelFitResult = z.infer<typeof assessModelFitResultSchema>;
export type AssessModelFitRequest = z.infer<typeof assessModelFitRequestSchema>;
export type AssessModelFitResponse = z.infer<typeof assessModelFitResponseSchema>;
