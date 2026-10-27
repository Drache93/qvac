import { z } from 'zod';
import { type TranscribeSegment } from './transcription.js';
export declare const neuralInputSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"base64">;
    value: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"filePath">;
    value: z.ZodString;
}, z.core.$strip>], "type">;
export declare const bciTranscribeParamsSchema: z.ZodObject<{
    modelId: z.ZodString;
    metadata: z.ZodOptional<z.ZodBoolean>;
    neuralData: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
}, z.core.$strip>;
export declare const bciTranscribeClientParamsSchema: z.ZodObject<{
    modelId: z.ZodString;
    metadata: z.ZodOptional<z.ZodBoolean>;
    neuralData: z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<Uint8Array<ArrayBuffer>>]>;
}, z.core.$strip>;
export declare const bciTranscribeRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    metadata: z.ZodOptional<z.ZodBoolean>;
    neuralData: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"base64">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"filePath">;
        value: z.ZodString;
    }, z.core.$strip>], "type">;
    type: z.ZodLiteral<"bciTranscribe">;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * A streamed BCI segment. Only the sliding-window stream produces
 * `windowStartTimestep`, so it is not on the shared segment shape.
 */
export declare const bciStreamSegmentSchema: z.ZodObject<{
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
    windowStartTimestep: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const bciTranscribeResponseSchema: z.ZodObject<{
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
    type: z.ZodLiteral<"bciTranscribe">;
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
}, z.core.$strip>;
/**
 * Per-call overrides for the BCI addon's sliding-window streaming
 * (`transcribeStream`). Each field maps 1:1 to the addon's `streamOpts`;
 * any field omitted falls back to the addon default.
 */
export declare const bciStreamOptsSchema: z.ZodObject<{
    windowTimesteps: z.ZodOptional<z.ZodNumber>;
    hopTimesteps: z.ZodOptional<z.ZodNumber>;
    emit: z.ZodOptional<z.ZodEnum<{
        full: "full";
        delta: "delta";
    }>>;
}, z.core.$strip>;
export declare const bciTranscribeStreamRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    metadata: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodLiteral<"bciTranscribeStream">;
    streamOpts: z.ZodOptional<z.ZodObject<{
        windowTimesteps: z.ZodOptional<z.ZodNumber>;
        hopTimesteps: z.ZodOptional<z.ZodNumber>;
        emit: z.ZodOptional<z.ZodEnum<{
            full: "full";
            delta: "delta";
        }>>;
    }, z.core.$strip>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const bciTranscribeStreamResponseSchema: z.ZodObject<{
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
    type: z.ZodLiteral<"bciTranscribeStream">;
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
        windowStartTimestep: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type NeuralInput = z.infer<typeof neuralInputSchema>;
export type BciTranscribeParams = z.infer<typeof bciTranscribeParamsSchema>;
export type BciTranscribeRequest = z.infer<typeof bciTranscribeRequestSchema>;
export type BciTranscribeResponse = z.infer<typeof bciTranscribeResponseSchema>;
export type BciTranscribeClientParamsParsed = z.output<typeof bciTranscribeClientParamsSchema>;
export type BciStreamOpts = z.infer<typeof bciStreamOptsSchema>;
export type BciTranscribeStreamRequest = z.infer<typeof bciTranscribeStreamRequestSchema>;
export type BciTranscribeStreamResponse = z.infer<typeof bciTranscribeStreamResponseSchema>;
export type BciStreamSegment = z.infer<typeof bciStreamSegmentSchema>;
/** Client parameters for `bciTranscribe()`. */
export interface BciTranscribeClientParams {
    /** Identifier returned by `loadModel()` for a loaded BCI model. */
    modelId: string;
    /**
     * BCI neural input. A string is treated as a `.bin` file path;
     * a `Uint8Array` is treated as raw neural bytes and sent as base64 on the
     * wire.
     */
    neuralData: string | Uint8Array;
    /**
     * When true, resolves to transcript segment metadata objects
     * (`{ text, startMs, endMs, append, id }`) instead of joined text.
     */
    metadata?: boolean;
}
export type BciTranscribeStreamClientParams = {
    modelId: string;
    metadata?: boolean;
    windowTimesteps?: number;
    hopTimesteps?: number;
    emit?: 'delta' | 'full';
};
export interface BciTranscribeStreamSession {
    /**
     * Stable id for this in-flight BCI stream. Pass to `cancel({ requestId })`
     * to target this duplex session without cancelling other work on the model.
     */
    requestId: string;
    write(neuralChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<string>;
}
export interface BciTranscribeStreamMetadataSession {
    /**
     * Stable id for this in-flight BCI stream. Pass to `cancel({ requestId })`
     * to target this duplex session without cancelling other work on the model.
     */
    requestId: string;
    write(neuralChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TranscribeSegment>;
}
