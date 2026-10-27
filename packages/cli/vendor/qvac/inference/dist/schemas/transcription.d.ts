import { z } from 'zod';
import type Buffer from 'bare-buffer';
import { type InferenceBackendDiagnostics } from './system-resources.js';
export declare const audioInputSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"base64">;
    value: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"filePath">;
    value: z.ZodString;
}, z.core.$strip>], "type">;
export declare const transcribeParamsSchema: z.ZodObject<{
    modelId: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodBoolean>;
    audioChunk: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
    hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxNewTokens: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const transcribeStatsSchema: z.ZodObject<{
    audioDuration: z.ZodOptional<z.ZodNumber>;
    realTimeFactor: z.ZodOptional<z.ZodNumber>;
    tokensPerSecond: z.ZodOptional<z.ZodNumber>;
    totalTokens: z.ZodOptional<z.ZodNumber>;
    totalSegments: z.ZodOptional<z.ZodNumber>;
    whisperEncodeTime: z.ZodOptional<z.ZodNumber>;
    whisperDecodeTime: z.ZodOptional<z.ZodNumber>;
    encoderTime: z.ZodOptional<z.ZodNumber>;
    decoderTime: z.ZodOptional<z.ZodNumber>;
    melSpecTime: z.ZodOptional<z.ZodNumber>;
    backendDevice: z.ZodOptional<z.ZodNumber>;
    backendId: z.ZodOptional<z.ZodNumber>;
    gpuUnsupported: z.ZodOptional<z.ZodNumber>;
    gpuMemTotalMb: z.ZodOptional<z.ZodNumber>;
    gpuMemFreeMb: z.ZodOptional<z.ZodNumber>;
    totalTime: z.ZodOptional<z.ZodNumber>;
    totalWallMs: z.ZodOptional<z.ZodNumber>;
    totalSamples: z.ZodOptional<z.ZodNumber>;
    processCalls: z.ZodOptional<z.ZodNumber>;
    whisperSampleMs: z.ZodOptional<z.ZodNumber>;
    whisperBatchdMs: z.ZodOptional<z.ZodNumber>;
    whisperPromptMs: z.ZodOptional<z.ZodNumber>;
    totalTranscriptions: z.ZodOptional<z.ZodNumber>;
    modelLoadMs: z.ZodOptional<z.ZodNumber>;
    totalEncodedFrames: z.ZodOptional<z.ZodNumber>;
    encoderOnCoreml: z.ZodOptional<z.ZodNumber>;
    encoderUsedCoreml: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Compute backends the ASR engines report through `stats.backendId`, as the
 * addon's `BackendId` enum defines them. Exported so callers can decode the
 * number instead of hardcoding it.
 *
 * Kept as a literal because it feeds the contract, and checked against the
 * addon's enum by `satisfies`: a backend the addon adds or removes is a compile
 * error here rather than a silently short vocabulary.
 */
export declare const ASR_BACKEND_IDS: Readonly<{
    readonly CPU: 0;
    readonly Metal: 1;
    readonly CUDA: 2;
    readonly Vulkan: 3;
    readonly OpenCL: 4;
    readonly Other: 99;
}>;
export type AsrBackendId = (typeof ASR_BACKEND_IDS)[keyof typeof ASR_BACKEND_IDS];
export declare const transcribeSpeakerSegmentSchema: z.ZodObject<{
    speakerId: z.ZodNumber;
    startMs: z.ZodNumber;
    endMs: z.ZodNumber;
}, z.core.$strip>;
export type TranscribeSpeakerSegment = z.infer<typeof transcribeSpeakerSegmentSchema>;
export declare const transcribeSegmentSchema: z.ZodObject<{
    text: z.ZodString;
    startMs: z.ZodNumber;
    endMs: z.ZodNumber;
    append: z.ZodBoolean;
    id: z.ZodNumber;
    speakerId: z.ZodOptional<z.ZodNumber>;
    speaker: z.ZodOptional<z.ZodString>;
    speakerSegments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        speakerId: z.ZodNumber;
        startMs: z.ZodNumber;
        endMs: z.ZodNumber;
    }, z.core.$strip>>>;
    isEndOfTurn: z.ZodOptional<z.ZodBoolean>;
    startsWord: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const vadStateEventSchema: z.ZodObject<{
    speakerId: z.ZodOptional<z.ZodNumber>;
    speaking: z.ZodBoolean;
    probability: z.ZodNumber;
    source: z.ZodOptional<z.ZodEnum<{
        silero: "silero";
        energy: "energy";
        sortformer: "sortformer";
    }>>;
}, z.core.$strip>;
export declare const whisperEndOfTurnEventSchema: z.ZodObject<{
    source: z.ZodLiteral<"whisper">;
    silenceDurationMs: z.ZodNumber;
}, z.core.$strip>;
export declare const parakeetEndOfTurnEventSchema: z.ZodObject<{
    source: z.ZodLiteral<"parakeet">;
}, z.core.$strip>;
export declare const endOfTurnEventSchema: z.ZodPreprocess<z.ZodDiscriminatedUnion<[z.ZodObject<{
    source: z.ZodLiteral<"whisper">;
    silenceDurationMs: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    source: z.ZodLiteral<"parakeet">;
}, z.core.$strip>], "source">, unknown>;
export declare const transcribeRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodBoolean>;
    audioChunk: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
    hotwords: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxNewTokens: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"transcribe">;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const transcribeResponseSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    done: z.ZodOptional<z.ZodBoolean>;
    stats: z.ZodOptional<z.ZodObject<{
        audioDuration: z.ZodOptional<z.ZodNumber>;
        realTimeFactor: z.ZodOptional<z.ZodNumber>;
        tokensPerSecond: z.ZodOptional<z.ZodNumber>;
        totalTokens: z.ZodOptional<z.ZodNumber>;
        totalSegments: z.ZodOptional<z.ZodNumber>;
        whisperEncodeTime: z.ZodOptional<z.ZodNumber>;
        whisperDecodeTime: z.ZodOptional<z.ZodNumber>;
        encoderTime: z.ZodOptional<z.ZodNumber>;
        decoderTime: z.ZodOptional<z.ZodNumber>;
        melSpecTime: z.ZodOptional<z.ZodNumber>;
        backendDevice: z.ZodOptional<z.ZodNumber>;
        backendId: z.ZodOptional<z.ZodNumber>;
        gpuUnsupported: z.ZodOptional<z.ZodNumber>;
        gpuMemTotalMb: z.ZodOptional<z.ZodNumber>;
        gpuMemFreeMb: z.ZodOptional<z.ZodNumber>;
        totalTime: z.ZodOptional<z.ZodNumber>;
        totalWallMs: z.ZodOptional<z.ZodNumber>;
        totalSamples: z.ZodOptional<z.ZodNumber>;
        processCalls: z.ZodOptional<z.ZodNumber>;
        whisperSampleMs: z.ZodOptional<z.ZodNumber>;
        whisperBatchdMs: z.ZodOptional<z.ZodNumber>;
        whisperPromptMs: z.ZodOptional<z.ZodNumber>;
        totalTranscriptions: z.ZodOptional<z.ZodNumber>;
        modelLoadMs: z.ZodOptional<z.ZodNumber>;
        totalEncodedFrames: z.ZodOptional<z.ZodNumber>;
        encoderOnCoreml: z.ZodOptional<z.ZodNumber>;
        encoderUsedCoreml: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    error: z.ZodOptional<z.ZodString>;
    segment: z.ZodOptional<z.ZodObject<{
        text: z.ZodString;
        startMs: z.ZodNumber;
        endMs: z.ZodNumber;
        append: z.ZodBoolean;
        id: z.ZodNumber;
        speakerId: z.ZodOptional<z.ZodNumber>;
        speaker: z.ZodOptional<z.ZodString>;
        speakerSegments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            speakerId: z.ZodNumber;
            startMs: z.ZodNumber;
            endMs: z.ZodNumber;
        }, z.core.$strip>>>;
        isEndOfTurn: z.ZodOptional<z.ZodBoolean>;
        startsWord: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    vad: z.ZodOptional<z.ZodObject<{
        speakerId: z.ZodOptional<z.ZodNumber>;
        speaking: z.ZodBoolean;
        probability: z.ZodNumber;
        source: z.ZodOptional<z.ZodEnum<{
            silero: "silero";
            energy: "energy";
            sortformer: "sortformer";
        }>>;
    }, z.core.$strip>>;
    endOfTurn: z.ZodOptional<z.ZodPreprocess<z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"whisper">;
        silenceDurationMs: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"parakeet">;
    }, z.core.$strip>], "source">, unknown>>;
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
    type: z.ZodLiteral<"transcribe">;
}, z.core.$strip>;
export type AudioInput = z.infer<typeof audioInputSchema>;
export type TranscribeParams = z.infer<typeof transcribeParamsSchema>;
export type TranscribeSegment = z.infer<typeof transcribeSegmentSchema>;
export type TranscribeClientParams = {
    modelId: string;
    audioChunk: string | Buffer;
    hotwords?: string[];
    maxNewTokens?: number;
    prompt?: string;
    metadata?: boolean;
};
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
/**
 * Per-call overrides for parakeet's duplex streaming session.
 *
 * Each field maps to its `streaming*`-prefixed counterpart in
 * `parakeetConfig` (see `parakeetRuntimeConfigSchema`). The `streaming`
 * prefix is intentionally dropped here because every field on this
 * object is already namespaced under the `parakeetStreamingConfig`
 * field of `transcribeStream({ ... })`. Any field omitted falls back
 * to the load-time value.
 */
export declare const parakeetStreamingRunConfigSchema: z.ZodObject<{
    chunkMs: z.ZodOptional<z.ZodNumber>;
    historyMs: z.ZodOptional<z.ZodNumber>;
    leftContextMs: z.ZodOptional<z.ZodNumber>;
    rightLookaheadMs: z.ZodOptional<z.ZodNumber>;
    emitPartials: z.ZodOptional<z.ZodBoolean>;
    emitEnergyVad: z.ZodOptional<z.ZodBoolean>;
    emitSpeakerVad: z.ZodOptional<z.ZodBoolean>;
    diarizationThreshold: z.ZodOptional<z.ZodNumber>;
    diarizationMinSegmentMs: z.ZodOptional<z.ZodNumber>;
    spkCacheEnable: z.ZodOptional<z.ZodBoolean>;
    spkCacheLen: z.ZodOptional<z.ZodNumber>;
    fifoLen: z.ZodOptional<z.ZodNumber>;
    chunkLeftContextMs: z.ZodOptional<z.ZodNumber>;
    chunkRightContextMs: z.ZodOptional<z.ZodNumber>;
    spkCacheUpdatePeriod: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ParakeetStreamingRunConfig = z.infer<typeof parakeetStreamingRunConfigSchema>;
export declare const transcribeStreamRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodLiteral<"transcribeStream">;
    emitVadEvents: z.ZodOptional<z.ZodBoolean>;
    endOfTurnSilenceMs: z.ZodOptional<z.ZodNumber>;
    vadRunIntervalMs: z.ZodOptional<z.ZodNumber>;
    parakeetStreamingConfig: z.ZodOptional<z.ZodObject<{
        chunkMs: z.ZodOptional<z.ZodNumber>;
        historyMs: z.ZodOptional<z.ZodNumber>;
        leftContextMs: z.ZodOptional<z.ZodNumber>;
        rightLookaheadMs: z.ZodOptional<z.ZodNumber>;
        emitPartials: z.ZodOptional<z.ZodBoolean>;
        emitEnergyVad: z.ZodOptional<z.ZodBoolean>;
        emitSpeakerVad: z.ZodOptional<z.ZodBoolean>;
        diarizationThreshold: z.ZodOptional<z.ZodNumber>;
        diarizationMinSegmentMs: z.ZodOptional<z.ZodNumber>;
        spkCacheEnable: z.ZodOptional<z.ZodBoolean>;
        spkCacheLen: z.ZodOptional<z.ZodNumber>;
        fifoLen: z.ZodOptional<z.ZodNumber>;
        chunkLeftContextMs: z.ZodOptional<z.ZodNumber>;
        chunkRightContextMs: z.ZodOptional<z.ZodNumber>;
        spkCacheUpdatePeriod: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const transcribeStreamResponseSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    done: z.ZodOptional<z.ZodBoolean>;
    stats: z.ZodOptional<z.ZodObject<{
        audioDuration: z.ZodOptional<z.ZodNumber>;
        realTimeFactor: z.ZodOptional<z.ZodNumber>;
        tokensPerSecond: z.ZodOptional<z.ZodNumber>;
        totalTokens: z.ZodOptional<z.ZodNumber>;
        totalSegments: z.ZodOptional<z.ZodNumber>;
        whisperEncodeTime: z.ZodOptional<z.ZodNumber>;
        whisperDecodeTime: z.ZodOptional<z.ZodNumber>;
        encoderTime: z.ZodOptional<z.ZodNumber>;
        decoderTime: z.ZodOptional<z.ZodNumber>;
        melSpecTime: z.ZodOptional<z.ZodNumber>;
        backendDevice: z.ZodOptional<z.ZodNumber>;
        backendId: z.ZodOptional<z.ZodNumber>;
        gpuUnsupported: z.ZodOptional<z.ZodNumber>;
        gpuMemTotalMb: z.ZodOptional<z.ZodNumber>;
        gpuMemFreeMb: z.ZodOptional<z.ZodNumber>;
        totalTime: z.ZodOptional<z.ZodNumber>;
        totalWallMs: z.ZodOptional<z.ZodNumber>;
        totalSamples: z.ZodOptional<z.ZodNumber>;
        processCalls: z.ZodOptional<z.ZodNumber>;
        whisperSampleMs: z.ZodOptional<z.ZodNumber>;
        whisperBatchdMs: z.ZodOptional<z.ZodNumber>;
        whisperPromptMs: z.ZodOptional<z.ZodNumber>;
        totalTranscriptions: z.ZodOptional<z.ZodNumber>;
        modelLoadMs: z.ZodOptional<z.ZodNumber>;
        totalEncodedFrames: z.ZodOptional<z.ZodNumber>;
        encoderOnCoreml: z.ZodOptional<z.ZodNumber>;
        encoderUsedCoreml: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    error: z.ZodOptional<z.ZodString>;
    segment: z.ZodOptional<z.ZodObject<{
        text: z.ZodString;
        startMs: z.ZodNumber;
        endMs: z.ZodNumber;
        append: z.ZodBoolean;
        id: z.ZodNumber;
        speakerId: z.ZodOptional<z.ZodNumber>;
        speaker: z.ZodOptional<z.ZodString>;
        speakerSegments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            speakerId: z.ZodNumber;
            startMs: z.ZodNumber;
            endMs: z.ZodNumber;
        }, z.core.$strip>>>;
        isEndOfTurn: z.ZodOptional<z.ZodBoolean>;
        startsWord: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    vad: z.ZodOptional<z.ZodObject<{
        speakerId: z.ZodOptional<z.ZodNumber>;
        speaking: z.ZodBoolean;
        probability: z.ZodNumber;
        source: z.ZodOptional<z.ZodEnum<{
            silero: "silero";
            energy: "energy";
            sortformer: "sortformer";
        }>>;
    }, z.core.$strip>>;
    endOfTurn: z.ZodOptional<z.ZodPreprocess<z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"whisper">;
        silenceDurationMs: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"parakeet">;
    }, z.core.$strip>], "source">, unknown>>;
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
    type: z.ZodLiteral<"transcribeStream">;
}, z.core.$strip>;
export type TranscribeStreamRequest = z.infer<typeof transcribeStreamRequestSchema>;
export type TranscribeStreamResponse = z.infer<typeof transcribeStreamResponseSchema>;
export type TranscribeStreamClientParams = {
    modelId: string;
    prompt?: string;
    metadata?: boolean;
    emitVadEvents?: boolean;
    endOfTurnSilenceMs?: number;
    vadRunIntervalMs?: number;
    parakeetStreamingConfig?: ParakeetStreamingRunConfig;
};
export interface TranscribeStreamSession {
    stats: Promise<TranscribeStats | undefined>;
    /** Backend selection detail for the session, settled from the same terminal frame as `stats`. */
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<string>;
}
export interface TranscribeStreamMetadataSession {
    stats: Promise<TranscribeStats | undefined>;
    /** Backend selection detail for the session, settled from the same terminal frame as `stats`. */
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TranscribeSegment>;
}
export type VadStateEvent = z.infer<typeof vadStateEventSchema>;
export type WhisperEndOfTurnEvent = z.infer<typeof whisperEndOfTurnEventSchema>;
export type ParakeetEndOfTurnEvent = z.infer<typeof parakeetEndOfTurnEventSchema>;
export type EndOfTurnEvent = z.infer<typeof endOfTurnEventSchema>;
export type TranscribeStreamEvent = {
    type: 'text';
    text: string;
} | {
    type: 'segment';
    segment: TranscribeSegment;
} | ({
    type: 'vad';
} & VadStateEvent) | ({
    type: 'endOfTurn';
} & EndOfTurnEvent);
export interface TranscribeStreamConversationSession {
    stats: Promise<TranscribeStats | undefined>;
    /** Backend selection detail for the session, settled from the same terminal frame as `stats`. */
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TranscribeStreamEvent>;
}
export type TranscribeStats = z.infer<typeof transcribeStatsSchema>;
