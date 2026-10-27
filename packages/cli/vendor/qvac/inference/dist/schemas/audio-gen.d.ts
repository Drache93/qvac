import { z } from 'zod';
import { type InferenceBackendDiagnostics } from './system-resources.js';
export declare const AUDIOGEN_ENGINES: readonly ["acestep", "minimax"];
export declare const audioGenEngineSchema: z.ZodEnum<{
    acestep: "acestep";
    minimax: "minimax";
}>;
/** Sample rate the ACE-Step engine expects for reference and source audio. */
export declare const AUDIOGEN_INPUT_SAMPLE_RATE = 48000;
/** Channel count (interleaved stereo) the ACE-Step engine expects for input audio. */
export declare const AUDIOGEN_INPUT_CHANNELS = 2;
/**
 * Longest reference/source clip the SDK accepts (10 minutes). Bounds the PCM
 * the server materializes per input — a 48 kHz stereo Float32 clip weighs
 * 384 KB per second — so a request cannot exhaust the inference process.
 */
export declare const AUDIOGEN_INPUT_MAX_SECONDS = 600;
/** Longest `audioCodes` array the SDK accepts (600 s at 5 codes per second). */
export declare const AUDIOGEN_MAX_AUDIO_CODES: number;
/**
 * Operations `audioEdit()` chains over a source recording, in the vocabulary
 * of `@qvac/audiogen-ggml`'s `AudioEditOperationType` (ACE-Step only):
 * `flow-edit` re-conditions the whole clip from a source prompt to a target
 * prompt, `repaint` regenerates a time range against a new prompt.
 */
export declare const AUDIOGEN_EDIT_OPERATIONS: readonly ["flow-edit", "repaint"];
export declare const audioGenEditOperationTypeSchema: z.ZodEnum<{
    "flow-edit": "flow-edit";
    repaint: "repaint";
}>;
/** Repaint preservation modes; `balanced` is the default and honours `strength`. */
export declare const AUDIOGEN_REPAINT_MODES: readonly ["conservative", "balanced", "aggressive"];
export declare const audioGenRepaintModeSchema: z.ZodEnum<{
    conservative: "conservative";
    balanced: "balanced";
    aggressive: "aggressive";
}>;
/**
 * ACE-Step task discriminators reachable through the SDK. `text2music` is the
 * default caption-driven generation; `cover-nofsq` re-renders `sourceAudio`
 * with a new caption while keeping its structure; `lego` regenerates a single
 * instrument layer of `sourceAudio`, named by `track`. The engine also
 * reserves an FSQ-roundtrip `cover` task that is not implemented yet, so it is
 * not offered here.
 */
export declare const AUDIOGEN_TASK_TYPES: readonly ["text2music", "cover-nofsq", "lego"];
export declare const audioGenTaskTypeSchema: z.ZodEnum<{
    text2music: "text2music";
    "cover-nofsq": "cover-nofsq";
    lego: "lego";
}>;
/** Instrument layers the `lego` task can target, in the engine's vocabulary. */
export declare const AUDIOGEN_TRACKS: readonly ["vocals", "backing_vocals", "drums", "bass", "guitar", "keyboard", "percussion", "strings", "synth", "fx", "brass", "woodwinds"];
export declare const audioGenTrackSchema: z.ZodEnum<{
    vocals: "vocals";
    backing_vocals: "backing_vocals";
    drums: "drums";
    bass: "bass";
    guitar: "guitar";
    keyboard: "keyboard";
    percussion: "percussion";
    strings: "strings";
    synth: "synth";
    fx: "fx";
    brass: "brass";
    woodwinds: "woodwinds";
}>;
declare const acestepAudioGenRuntimeConfigSchema: z.ZodObject<{
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    nGpuLayers: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodOptional<z.ZodLiteral<"acestep">>;
}, z.core.$strict>;
declare const minimaxAudioGenRuntimeConfigSchema: z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
        auto: "auto";
    }>>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"minimax">;
}, z.core.$strict>;
export declare const audioGenRuntimeConfigSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    nGpuLayers: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodOptional<z.ZodLiteral<"acestep">>;
}, z.core.$strict>, z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
        auto: "auto";
    }>>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"minimax">;
}, z.core.$strict>], "engine">;
declare const acestepAudioGenConfigSchema: z.ZodObject<{
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    nGpuLayers: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodOptional<z.ZodLiteral<"acestep">>;
    textEncModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    lmModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    ditModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    vaeModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
}, z.core.$strict>;
declare const minimaxAudioGenConfigSchema: z.ZodObject<{
    lmModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    synthModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
        auto: "auto";
    }>>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"minimax">;
}, z.core.$strict>;
export declare const audioGenConfigSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    nGpuLayers: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodOptional<z.ZodLiteral<"acestep">>;
    textEncModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    lmModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    ditModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    vaeModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
}, z.core.$strict>, z.ZodObject<{
    lmModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    synthModelSrc: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>]>;
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
        auto: "auto";
    }>>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    useGPU: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    backendsDir: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"minimax">;
}, z.core.$strict>], "engine">;
/**
 * Wire form of a reference/source audio input. `filePath` inputs are decoded
 * server-side (any format the SDK's audio decoder supports, plus raw PCM);
 * `base64` inputs must already be interleaved stereo 48 kHz Float32 LE PCM.
 */
export declare const audioGenAudioInputSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"base64">;
    value: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"filePath">;
    value: z.ZodString;
}, z.core.$strip>], "type">;
/**
 * Client form of a reference/source audio input: a file path, or raw
 * interleaved stereo 48 kHz Float32 LE PCM bytes. Normalized to the wire form.
 */
export declare const audioGenClientAudioInputSchema: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
    type: "base64";
    value: string;
} | {
    type: "filePath";
    value: string;
}, string | Uint8Array<ArrayBuffer>>>;
/**
 * Client form of `audioCodes`: the `Int32Array` the addon works with, or a
 * plain number array. Normalized to the wire form.
 */
export declare const audioGenClientAudioCodesSchema: z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodInstanceOf<Int32Array<ArrayBuffer>>, z.ZodTransform<number[], Int32Array<ArrayBuffer>>>, z.ZodArray<z.ZodNumber>]>, z.ZodArray<z.ZodNumber>>;
export declare const audioGenClientParamsSchema: z.ZodObject<{
    audioCodes: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodInstanceOf<Int32Array<ArrayBuffer>>, z.ZodTransform<number[], Int32Array<ArrayBuffer>>>, z.ZodArray<z.ZodNumber>]>, z.ZodArray<z.ZodNumber>>>;
    referenceAudio: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
        type: "base64";
        value: string;
    } | {
        type: "filePath";
        value: string;
    }, string | Uint8Array<ArrayBuffer>>>>;
    sourceAudio: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
        type: "base64";
        value: string;
    } | {
        type: "filePath";
        value: string;
    }, string | Uint8Array<ArrayBuffer>>>>;
    modelId: z.ZodString;
    caption: z.ZodString;
    lyrics: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    keyscale: z.ZodOptional<z.ZodString>;
    timesignature: z.ZodOptional<z.ZodString>;
    augmentCaptionWithMetadata: z.ZodOptional<z.ZodBoolean>;
    simpleMode: z.ZodOptional<z.ZodBoolean>;
    rewriteQuery: z.ZodOptional<z.ZodBoolean>;
    generateLrc: z.ZodOptional<z.ZodBoolean>;
    computeQualityScore: z.ZodOptional<z.ZodBoolean>;
    normalizeLoudness: z.ZodOptional<z.ZodBoolean>;
    guidanceScale: z.ZodOptional<z.ZodNumber>;
    track: z.ZodOptional<z.ZodEnum<{
        vocals: "vocals";
        backing_vocals: "backing_vocals";
        drums: "drums";
        bass: "bass";
        guitar: "guitar";
        keyboard: "keyboard";
        percussion: "percussion";
        strings: "strings";
        synth: "synth";
        fx: "fx";
        brass: "brass";
        woodwinds: "woodwinds";
    }>>;
    duration: z.ZodOptional<z.ZodNumber>;
    maxFrames: z.ZodOptional<z.ZodNumber>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    lmTemperature: z.ZodOptional<z.ZodNumber>;
    lmTopP: z.ZodOptional<z.ZodNumber>;
    lmTopK: z.ZodOptional<z.ZodNumber>;
    lmCfgScale: z.ZodOptional<z.ZodNumber>;
    lmPhase1: z.ZodOptional<z.ZodBoolean>;
    dcwEnabled: z.ZodOptional<z.ZodBoolean>;
    dcwScaler: z.ZodOptional<z.ZodNumber>;
    dcwHighScaler: z.ZodOptional<z.ZodNumber>;
    taskType: z.ZodOptional<z.ZodEnum<{
        text2music: "text2music";
        "cover-nofsq": "cover-nofsq";
        lego: "lego";
    }>>;
    audioCoverStrength: z.ZodOptional<z.ZodNumber>;
    coverNoiseStrength: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioGenStreamRequestSchema: z.ZodObject<{
    type: z.ZodLiteral<"audioGenStream">;
    requestId: z.ZodOptional<z.ZodString>;
    audioCodes: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    referenceAudio: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">>;
    sourceAudio: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">>;
    modelId: z.ZodString;
    caption: z.ZodString;
    lyrics: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    keyscale: z.ZodOptional<z.ZodString>;
    timesignature: z.ZodOptional<z.ZodString>;
    augmentCaptionWithMetadata: z.ZodOptional<z.ZodBoolean>;
    simpleMode: z.ZodOptional<z.ZodBoolean>;
    rewriteQuery: z.ZodOptional<z.ZodBoolean>;
    generateLrc: z.ZodOptional<z.ZodBoolean>;
    computeQualityScore: z.ZodOptional<z.ZodBoolean>;
    normalizeLoudness: z.ZodOptional<z.ZodBoolean>;
    guidanceScale: z.ZodOptional<z.ZodNumber>;
    track: z.ZodOptional<z.ZodEnum<{
        vocals: "vocals";
        backing_vocals: "backing_vocals";
        drums: "drums";
        bass: "bass";
        guitar: "guitar";
        keyboard: "keyboard";
        percussion: "percussion";
        strings: "strings";
        synth: "synth";
        fx: "fx";
        brass: "brass";
        woodwinds: "woodwinds";
    }>>;
    duration: z.ZodOptional<z.ZodNumber>;
    maxFrames: z.ZodOptional<z.ZodNumber>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
    cfgScale: z.ZodOptional<z.ZodNumber>;
    lmTemperature: z.ZodOptional<z.ZodNumber>;
    lmTopP: z.ZodOptional<z.ZodNumber>;
    lmTopK: z.ZodOptional<z.ZodNumber>;
    lmCfgScale: z.ZodOptional<z.ZodNumber>;
    lmPhase1: z.ZodOptional<z.ZodBoolean>;
    dcwEnabled: z.ZodOptional<z.ZodBoolean>;
    dcwScaler: z.ZodOptional<z.ZodNumber>;
    dcwHighScaler: z.ZodOptional<z.ZodNumber>;
    taskType: z.ZodOptional<z.ZodEnum<{
        text2music: "text2music";
        "cover-nofsq": "cover-nofsq";
        lego: "lego";
    }>>;
    audioCoverStrength: z.ZodOptional<z.ZodNumber>;
    coverNoiseStrength: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
declare const audioEditPromptSchema: z.ZodObject<{
    caption: z.ZodString;
    lyrics: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const audioEditFlowEditOperationSchema: z.ZodObject<{
    type: z.ZodLiteral<"flow-edit">;
    from: z.ZodObject<{
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    to: z.ZodObject<{
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    nMin: z.ZodOptional<z.ZodNumber>;
    nMax: z.ZodOptional<z.ZodNumber>;
    nAvg: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioEditRepaintOperationSchema: z.ZodObject<{
    type: z.ZodLiteral<"repaint">;
    caption: z.ZodString;
    lyrics: z.ZodOptional<z.ZodString>;
    start: z.ZodNumber;
    end: z.ZodOptional<z.ZodNumber>;
    mode: z.ZodOptional<z.ZodEnum<{
        conservative: "conservative";
        balanced: "balanced";
        aggressive: "aggressive";
    }>>;
    strength: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioEditOperationSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"flow-edit">;
    from: z.ZodObject<{
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    to: z.ZodObject<{
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    nMin: z.ZodOptional<z.ZodNumber>;
    nMax: z.ZodOptional<z.ZodNumber>;
    nAvg: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"repaint">;
    caption: z.ZodString;
    lyrics: z.ZodOptional<z.ZodString>;
    start: z.ZodNumber;
    end: z.ZodOptional<z.ZodNumber>;
    mode: z.ZodOptional<z.ZodEnum<{
        conservative: "conservative";
        balanced: "balanced";
        aggressive: "aggressive";
    }>>;
    strength: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>], "type">;
export declare const audioEditClientParamsSchema: z.ZodObject<{
    sourceAudio: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
        type: "base64";
        value: string;
    } | {
        type: "filePath";
        value: string;
    }, string | Uint8Array<ArrayBuffer>>>;
    referenceAudio: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
        type: "base64";
        value: string;
    } | {
        type: "filePath";
        value: string;
    }, string | Uint8Array<ArrayBuffer>>>>;
    modelId: z.ZodString;
    operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"flow-edit">;
        from: z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        to: z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        nMin: z.ZodOptional<z.ZodNumber>;
        nMax: z.ZodOptional<z.ZodNumber>;
        nAvg: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"repaint">;
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
        start: z.ZodNumber;
        end: z.ZodOptional<z.ZodNumber>;
        mode: z.ZodOptional<z.ZodEnum<{
            conservative: "conservative";
            balanced: "balanced";
            aggressive: "aggressive";
        }>>;
        strength: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>], "type">>;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    keyscale: z.ZodOptional<z.ZodString>;
    timesignature: z.ZodOptional<z.ZodString>;
    augmentCaptionWithMetadata: z.ZodOptional<z.ZodBoolean>;
    dcwEnabled: z.ZodOptional<z.ZodBoolean>;
    dcwScaler: z.ZodOptional<z.ZodNumber>;
    dcwHighScaler: z.ZodOptional<z.ZodNumber>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioEditStreamRequestSchema: z.ZodObject<{
    sourceAudio: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
    referenceAudio: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">>;
    type: z.ZodLiteral<"audioEditStream">;
    requestId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodString;
    operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"flow-edit">;
        from: z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        to: z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        nMin: z.ZodOptional<z.ZodNumber>;
        nMax: z.ZodOptional<z.ZodNumber>;
        nAvg: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"repaint">;
        caption: z.ZodString;
        lyrics: z.ZodOptional<z.ZodString>;
        start: z.ZodNumber;
        end: z.ZodOptional<z.ZodNumber>;
        mode: z.ZodOptional<z.ZodEnum<{
            conservative: "conservative";
            balanced: "balanced";
            aggressive: "aggressive";
        }>>;
        strength: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>], "type">>;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    keyscale: z.ZodOptional<z.ZodString>;
    timesignature: z.ZodOptional<z.ZodString>;
    augmentCaptionWithMetadata: z.ZodOptional<z.ZodBoolean>;
    dcwEnabled: z.ZodOptional<z.ZodBoolean>;
    dcwScaler: z.ZodOptional<z.ZodNumber>;
    dcwHighScaler: z.ZodOptional<z.ZodNumber>;
    inferenceSteps: z.ZodOptional<z.ZodNumber>;
    shift: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type AudioGenProgress = {
    stage: string;
    step: number;
    /**
     * Total number of steps when greater than zero. Values less than or equal to zero mean
     * indeterminate progress and must not be rendered as a `step / total` determinate progress value.
     */
    total: number;
};
export declare const audioGenProgressSchema: z.ZodObject<{
    stage: z.ZodString;
    step: z.ZodNumber;
    total: z.ZodNumber;
}, z.core.$strip>;
/**
 * The LM's description of a clip, returned by `audioUnderstand()`. `audioCodes`
 * are the recovered FSQ codes, reusable as a generation's `audioCodes` input.
 */
export declare const audioGenUnderstandResultSchema: z.ZodObject<{
    caption: z.ZodString;
    bpm: z.ZodNumber;
    duration: z.ZodNumber;
    keyscale: z.ZodString;
    timesignature: z.ZodString;
    vocalLanguage: z.ZodString;
    audioCodes: z.ZodArray<z.ZodNumber>;
    seed: z.ZodNumber;
}, z.core.$strip>;
/**
 * What an ACE-Step run rendered, after the LM filled in what the caller left
 * unset (Phase 1, Simple Mode, Query Rewriting). An edit reports its base seed
 * and the prompt metadata it was given, with an empty caption and no code
 * frames. MiniMax runs report none.
 */
export declare const audioGenGenerationMetadataSchema: z.ZodObject<{
    caption: z.ZodString;
    lyrics: z.ZodString;
    bpm: z.ZodNumber;
    keyscale: z.ZodString;
    beatsPerBar: z.ZodNumber;
    vocalLanguage: z.ZodString;
    seed: z.ZodNumber;
    codeFrames: z.ZodNumber;
    qualityReport: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const audioGenStatsSchema: z.ZodObject<{
    audioDurationMs: z.ZodOptional<z.ZodNumber>;
    totalTimeMs: z.ZodOptional<z.ZodNumber>;
    realTimeFactor: z.ZodOptional<z.ZodNumber>;
    backendDevice: z.ZodOptional<z.ZodNumber>;
    backendId: z.ZodOptional<z.ZodNumber>;
    emittedFrames: z.ZodOptional<z.ZodNumber>;
    arMs: z.ZodOptional<z.ZodNumber>;
    conditionMs: z.ZodOptional<z.ZodNumber>;
    flowMs: z.ZodOptional<z.ZodNumber>;
    vocoderMs: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodObject<{
        caption: z.ZodString;
        lyrics: z.ZodString;
        bpm: z.ZodNumber;
        keyscale: z.ZodString;
        beatsPerBar: z.ZodNumber;
        vocalLanguage: z.ZodString;
        seed: z.ZodNumber;
        codeFrames: z.ZodNumber;
        qualityReport: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    lyricsScore: z.ZodOptional<z.ZodNumber>;
    lrc: z.ZodOptional<z.ZodString>;
    qualityScore: z.ZodOptional<z.ZodNumber>;
    understand: z.ZodOptional<z.ZodObject<{
        caption: z.ZodString;
        bpm: z.ZodNumber;
        duration: z.ZodNumber;
        keyscale: z.ZodString;
        timesignature: z.ZodString;
        vocalLanguage: z.ZodString;
        audioCodes: z.ZodArray<z.ZodNumber>;
        seed: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const audioUnderstandClientParamsSchema: z.ZodObject<{
    sourceAudio: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>, z.ZodTransform<{
        type: "base64";
        value: string;
    } | {
        type: "filePath";
        value: string;
    }, string | Uint8Array<ArrayBuffer>>>;
    modelId: z.ZodString;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    lmTemperature: z.ZodOptional<z.ZodNumber>;
    lmTopP: z.ZodOptional<z.ZodNumber>;
    lmTopK: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioUnderstandRequestSchema: z.ZodObject<{
    sourceAudio: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
    type: z.ZodLiteral<"audioUnderstand">;
    requestId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodString;
    seed: z.ZodOptional<z.ZodNumber>;
    vocalLanguage: z.ZodOptional<z.ZodString>;
    lmTemperature: z.ZodOptional<z.ZodNumber>;
    lmTopP: z.ZodOptional<z.ZodNumber>;
    lmTopK: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const audioUnderstandResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"audioUnderstand">;
    progress: z.ZodOptional<z.ZodObject<{
        stage: z.ZodString;
        step: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>>;
    understand: z.ZodOptional<z.ZodObject<{
        caption: z.ZodString;
        bpm: z.ZodNumber;
        duration: z.ZodNumber;
        keyscale: z.ZodString;
        timesignature: z.ZodString;
        vocalLanguage: z.ZodString;
        audioCodes: z.ZodArray<z.ZodNumber>;
        seed: z.ZodNumber;
    }, z.core.$strip>>;
    done: z.ZodDefault<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
    }>>;
    stats: z.ZodOptional<z.ZodObject<{
        audioDurationMs: z.ZodOptional<z.ZodNumber>;
        totalTimeMs: z.ZodOptional<z.ZodNumber>;
        realTimeFactor: z.ZodOptional<z.ZodNumber>;
        backendDevice: z.ZodOptional<z.ZodNumber>;
        backendId: z.ZodOptional<z.ZodNumber>;
        emittedFrames: z.ZodOptional<z.ZodNumber>;
        arMs: z.ZodOptional<z.ZodNumber>;
        conditionMs: z.ZodOptional<z.ZodNumber>;
        flowMs: z.ZodOptional<z.ZodNumber>;
        vocoderMs: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodString;
            bpm: z.ZodNumber;
            keyscale: z.ZodString;
            beatsPerBar: z.ZodNumber;
            vocalLanguage: z.ZodString;
            seed: z.ZodNumber;
            codeFrames: z.ZodNumber;
            qualityReport: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        lyricsScore: z.ZodOptional<z.ZodNumber>;
        lrc: z.ZodOptional<z.ZodString>;
        qualityScore: z.ZodOptional<z.ZodNumber>;
        understand: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            bpm: z.ZodNumber;
            duration: z.ZodNumber;
            keyscale: z.ZodString;
            timesignature: z.ZodString;
            vocalLanguage: z.ZodString;
            audioCodes: z.ZodArray<z.ZodNumber>;
            seed: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    diagnostics: z.ZodOptional<z.ZodObject<{
        selectedBackend: z.ZodString;
        selectedDevice: z.ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>;
        graphicsApi: z.ZodOptional<z.ZodEnum<{
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
            rocm: "rocm";
            opengl: "opengl";
            webgpu: "webgpu";
            direct3d11: "direct3d11";
            direct3d12: "direct3d12";
            levelZero: "levelZero";
        }>>;
        driver: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        gpuId: z.ZodOptional<z.ZodString>;
        fallback: z.ZodOptional<z.ZodObject<{
            requestedBackend: z.ZodOptional<z.ZodString>;
            requestedDevice: z.ZodOptional<z.ZodEnum<{
                cpu: "cpu";
                gpu: "gpu";
            }>>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        probe: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                unknown: "unknown";
                compatible: "compatible";
                incompatible: "incompatible";
            }>;
            backend: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const audioGenStreamResponseSchema: z.ZodObject<{
    progress: z.ZodOptional<z.ZodObject<{
        stage: z.ZodString;
        step: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>>;
    data: z.ZodOptional<z.ZodString>;
    sampleRate: z.ZodOptional<z.ZodNumber>;
    channels: z.ZodOptional<z.ZodNumber>;
    bitsPerSample: z.ZodOptional<z.ZodNumber>;
    done: z.ZodDefault<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
    }>>;
    stats: z.ZodOptional<z.ZodObject<{
        audioDurationMs: z.ZodOptional<z.ZodNumber>;
        totalTimeMs: z.ZodOptional<z.ZodNumber>;
        realTimeFactor: z.ZodOptional<z.ZodNumber>;
        backendDevice: z.ZodOptional<z.ZodNumber>;
        backendId: z.ZodOptional<z.ZodNumber>;
        emittedFrames: z.ZodOptional<z.ZodNumber>;
        arMs: z.ZodOptional<z.ZodNumber>;
        conditionMs: z.ZodOptional<z.ZodNumber>;
        flowMs: z.ZodOptional<z.ZodNumber>;
        vocoderMs: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodString;
            bpm: z.ZodNumber;
            keyscale: z.ZodString;
            beatsPerBar: z.ZodNumber;
            vocalLanguage: z.ZodString;
            seed: z.ZodNumber;
            codeFrames: z.ZodNumber;
            qualityReport: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        lyricsScore: z.ZodOptional<z.ZodNumber>;
        lrc: z.ZodOptional<z.ZodString>;
        qualityScore: z.ZodOptional<z.ZodNumber>;
        understand: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            bpm: z.ZodNumber;
            duration: z.ZodNumber;
            keyscale: z.ZodString;
            timesignature: z.ZodString;
            vocalLanguage: z.ZodString;
            audioCodes: z.ZodArray<z.ZodNumber>;
            seed: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    diagnostics: z.ZodOptional<z.ZodObject<{
        selectedBackend: z.ZodString;
        selectedDevice: z.ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>;
        graphicsApi: z.ZodOptional<z.ZodEnum<{
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
            rocm: "rocm";
            opengl: "opengl";
            webgpu: "webgpu";
            direct3d11: "direct3d11";
            direct3d12: "direct3d12";
            levelZero: "levelZero";
        }>>;
        driver: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        gpuId: z.ZodOptional<z.ZodString>;
        fallback: z.ZodOptional<z.ZodObject<{
            requestedBackend: z.ZodOptional<z.ZodString>;
            requestedDevice: z.ZodOptional<z.ZodEnum<{
                cpu: "cpu";
                gpu: "gpu";
            }>>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        probe: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                unknown: "unknown";
                compatible: "compatible";
                incompatible: "incompatible";
            }>;
            backend: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"audioGenStream">;
}, z.core.$strict>;
export declare const audioEditStreamResponseSchema: z.ZodObject<{
    progress: z.ZodOptional<z.ZodObject<{
        stage: z.ZodString;
        step: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>>;
    data: z.ZodOptional<z.ZodString>;
    sampleRate: z.ZodOptional<z.ZodNumber>;
    channels: z.ZodOptional<z.ZodNumber>;
    bitsPerSample: z.ZodOptional<z.ZodNumber>;
    done: z.ZodDefault<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
    }>>;
    stats: z.ZodOptional<z.ZodObject<{
        audioDurationMs: z.ZodOptional<z.ZodNumber>;
        totalTimeMs: z.ZodOptional<z.ZodNumber>;
        realTimeFactor: z.ZodOptional<z.ZodNumber>;
        backendDevice: z.ZodOptional<z.ZodNumber>;
        backendId: z.ZodOptional<z.ZodNumber>;
        emittedFrames: z.ZodOptional<z.ZodNumber>;
        arMs: z.ZodOptional<z.ZodNumber>;
        conditionMs: z.ZodOptional<z.ZodNumber>;
        flowMs: z.ZodOptional<z.ZodNumber>;
        vocoderMs: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            lyrics: z.ZodString;
            bpm: z.ZodNumber;
            keyscale: z.ZodString;
            beatsPerBar: z.ZodNumber;
            vocalLanguage: z.ZodString;
            seed: z.ZodNumber;
            codeFrames: z.ZodNumber;
            qualityReport: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        lyricsScore: z.ZodOptional<z.ZodNumber>;
        lrc: z.ZodOptional<z.ZodString>;
        qualityScore: z.ZodOptional<z.ZodNumber>;
        understand: z.ZodOptional<z.ZodObject<{
            caption: z.ZodString;
            bpm: z.ZodNumber;
            duration: z.ZodNumber;
            keyscale: z.ZodString;
            timesignature: z.ZodString;
            vocalLanguage: z.ZodString;
            audioCodes: z.ZodArray<z.ZodNumber>;
            seed: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    diagnostics: z.ZodOptional<z.ZodObject<{
        selectedBackend: z.ZodString;
        selectedDevice: z.ZodEnum<{
            cpu: "cpu";
            gpu: "gpu";
        }>;
        graphicsApi: z.ZodOptional<z.ZodEnum<{
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
            rocm: "rocm";
            opengl: "opengl";
            webgpu: "webgpu";
            direct3d11: "direct3d11";
            direct3d12: "direct3d12";
            levelZero: "levelZero";
        }>>;
        driver: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        gpuId: z.ZodOptional<z.ZodString>;
        fallback: z.ZodOptional<z.ZodObject<{
            requestedBackend: z.ZodOptional<z.ZodString>;
            requestedDevice: z.ZodOptional<z.ZodEnum<{
                cpu: "cpu";
                gpu: "gpu";
            }>>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        probe: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                unknown: "unknown";
                compatible: "compatible";
                incompatible: "incompatible";
            }>;
            backend: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"audioEditStream">;
}, z.core.$strict>;
export type AudioGenTaskType = z.infer<typeof audioGenTaskTypeSchema>;
export type AudioGenEditOperationType = z.infer<typeof audioGenEditOperationTypeSchema>;
export type AudioGenRepaintMode = z.infer<typeof audioGenRepaintModeSchema>;
export type AudioEditPrompt = z.infer<typeof audioEditPromptSchema>;
export type AudioEditFlowEditOperation = z.infer<typeof audioEditFlowEditOperationSchema>;
export type AudioEditRepaintOperation = z.infer<typeof audioEditRepaintOperationSchema>;
export type AudioEditOperation = z.infer<typeof audioEditOperationSchema>;
export type AudioEditClientParams = z.input<typeof audioEditClientParamsSchema>;
export type AudioEditStreamRequest = z.infer<typeof audioEditStreamRequestSchema>;
export type AudioEditStreamResponse = z.infer<typeof audioEditStreamResponseSchema>;
export type AudioGenEngine = z.infer<typeof audioGenEngineSchema>;
export type AudioGenAudioInput = z.infer<typeof audioGenAudioInputSchema>;
export type AcestepAudioGenRuntimeConfig = z.infer<typeof acestepAudioGenRuntimeConfigSchema>;
export type MinimaxAudioGenRuntimeConfig = z.infer<typeof minimaxAudioGenRuntimeConfigSchema>;
export type AudioGenRuntimeConfig = z.infer<typeof audioGenRuntimeConfigSchema>;
export type AcestepAudioGenConfig = z.infer<typeof acestepAudioGenConfigSchema>;
export type MinimaxAudioGenConfig = z.infer<typeof minimaxAudioGenConfigSchema>;
export type AudioGenConfig = z.infer<typeof audioGenConfigSchema>;
export type AudioGenClientParams = z.input<typeof audioGenClientParamsSchema>;
export type AudioGenStreamRequest = z.infer<typeof audioGenStreamRequestSchema>;
export type AudioGenStats = z.infer<typeof audioGenStatsSchema>;
export type AudioGenGenerationMetadata = z.infer<typeof audioGenGenerationMetadataSchema>;
export type AudioGenStreamResponse = z.infer<typeof audioGenStreamResponseSchema>;
export type AudioGenTrack = z.infer<typeof audioGenTrackSchema>;
export type AudioGenUnderstandResult = z.infer<typeof audioGenUnderstandResultSchema>;
export type AudioUnderstandClientParams = z.input<typeof audioUnderstandClientParamsSchema>;
export type AudioUnderstandRequest = z.infer<typeof audioUnderstandRequestSchema>;
export type AudioUnderstandResponse = z.infer<typeof audioUnderstandResponseSchema>;
export interface AudioGenAudio {
    pcm: Uint8Array;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
}
export interface AudioGenResult {
    requestId: string;
    progressStream: AsyncGenerator<AudioGenProgress>;
    audio: Promise<AudioGenAudio>;
    stats: Promise<AudioGenStats | undefined>;
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
}
/**
 * An `audioUnderstand()` run. Shaped like `AudioGenResult`, except the run
 * produces a description rather than audio.
 */
export interface AudioUnderstandResult {
    requestId: string;
    progressStream: AsyncGenerator<AudioGenProgress>;
    description: Promise<AudioGenUnderstandResult>;
    stats: Promise<AudioGenStats | undefined>;
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
}
export {};
