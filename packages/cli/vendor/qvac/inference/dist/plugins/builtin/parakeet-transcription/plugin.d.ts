import { type ParakeetConfig, type CreateModelParams, type PluginModelResult, type ResolveResult } from '../../../schemas/index.js';
export declare const parakeetPlugin: {
    modelType: "parakeet-transcription";
    displayName: string;
    addonPackage: "@qvac/asr-ggml";
    loadConfigSchema: import("zod").ZodObject<{
        [x: string]: import("zod").ZodOptional<import("zod").ZodUnknown>;
    }, import("zod/v4/core").$strict>;
    assessFit: typeof import("node_modules/@qvac/asr-ggml/lib/fit").assessFit;
    resolveConfig(cfg: ParakeetConfig): Promise<ResolveResult<ParakeetConfig>>;
    createModel(params: CreateModelParams): PluginModelResult;
    handlers: {
        transcribe: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            prompt: import("zod").ZodOptional<import("zod").ZodString>;
            metadata: import("zod").ZodOptional<import("zod").ZodBoolean>;
            audioChunk: import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"base64">;
                value: import("zod").ZodString;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"filePath">;
                value: import("zod").ZodString;
            }, import("zod/v4/core").$strip>], "type">;
            hotwords: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
            maxNewTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
            type: import("zod").ZodLiteral<"transcribe">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
            text: import("zod").ZodOptional<import("zod").ZodString>;
            done: import("zod").ZodOptional<import("zod").ZodBoolean>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                audioDuration: import("zod").ZodOptional<import("zod").ZodNumber>;
                realTimeFactor: import("zod").ZodOptional<import("zod").ZodNumber>;
                tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalSegments: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperEncodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperDecodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                decoderTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                melSpecTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendDevice: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendId: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuUnsupported: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuMemTotalMb: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuMemFreeMb: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalWallMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalSamples: import("zod").ZodOptional<import("zod").ZodNumber>;
                processCalls: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperSampleMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperBatchdMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperPromptMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTranscriptions: import("zod").ZodOptional<import("zod").ZodNumber>;
                modelLoadMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalEncodedFrames: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderOnCoreml: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderUsedCoreml: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            error: import("zod").ZodOptional<import("zod").ZodString>;
            segment: import("zod").ZodOptional<import("zod").ZodObject<{
                text: import("zod").ZodString;
                startMs: import("zod").ZodNumber;
                endMs: import("zod").ZodNumber;
                append: import("zod").ZodBoolean;
                id: import("zod").ZodNumber;
                speakerId: import("zod").ZodOptional<import("zod").ZodNumber>;
                speaker: import("zod").ZodOptional<import("zod").ZodString>;
                speakerSegments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    speakerId: import("zod").ZodNumber;
                    startMs: import("zod").ZodNumber;
                    endMs: import("zod").ZodNumber;
                }, import("zod/v4/core").$strip>>>;
                isEndOfTurn: import("zod").ZodOptional<import("zod").ZodBoolean>;
                startsWord: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod/v4/core").$strip>>;
            vad: import("zod").ZodOptional<import("zod").ZodObject<{
                speakerId: import("zod").ZodOptional<import("zod").ZodNumber>;
                speaking: import("zod").ZodBoolean;
                probability: import("zod").ZodNumber;
                source: import("zod").ZodOptional<import("zod").ZodEnum<{
                    silero: "silero";
                    energy: "energy";
                    sortformer: "sortformer";
                }>>;
            }, import("zod/v4/core").$strip>>;
            endOfTurn: import("zod").ZodOptional<import("zod").ZodPreprocess<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                source: import("zod").ZodLiteral<"whisper">;
                silenceDurationMs: import("zod").ZodNumber;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                source: import("zod").ZodLiteral<"parakeet">;
            }, import("zod/v4/core").$strip>], "source">, unknown>>;
            diagnostics: import("zod").ZodOptional<import("zod").ZodObject<{
                selectedBackend: import("zod").ZodString;
                selectedDevice: import("zod").ZodEnum<{
                    cpu: "cpu";
                    gpu: "gpu";
                }>;
                graphicsApi: import("zod").ZodOptional<import("zod").ZodEnum<{
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
                driver: import("zod").ZodOptional<import("zod").ZodObject<{
                    name: import("zod").ZodString;
                    version: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
                gpuId: import("zod").ZodOptional<import("zod").ZodString>;
                fallback: import("zod").ZodOptional<import("zod").ZodObject<{
                    requestedBackend: import("zod").ZodOptional<import("zod").ZodString>;
                    requestedDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                        cpu: "cpu";
                        gpu: "gpu";
                    }>>;
                    reason: import("zod").ZodString;
                }, import("zod/v4/core").$strip>>;
                probe: import("zod").ZodOptional<import("zod").ZodObject<{
                    status: import("zod").ZodEnum<{
                        unknown: "unknown";
                        compatible: "compatible";
                        incompatible: "incompatible";
                    }>;
                    backend: import("zod").ZodString;
                    reason: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
            }, import("zod/v4/core").$strip>>;
            type: import("zod").ZodLiteral<"transcribe">;
        }, import("zod/v4/core").$strip>>;
        transcribeStream: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            prompt: import("zod").ZodOptional<import("zod").ZodString>;
            metadata: import("zod").ZodOptional<import("zod").ZodBoolean>;
            type: import("zod").ZodLiteral<"transcribeStream">;
            emitVadEvents: import("zod").ZodOptional<import("zod").ZodBoolean>;
            endOfTurnSilenceMs: import("zod").ZodOptional<import("zod").ZodNumber>;
            vadRunIntervalMs: import("zod").ZodOptional<import("zod").ZodNumber>;
            parakeetStreamingConfig: import("zod").ZodOptional<import("zod").ZodObject<{
                chunkMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                historyMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                leftContextMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                rightLookaheadMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                emitPartials: import("zod").ZodOptional<import("zod").ZodBoolean>;
                emitEnergyVad: import("zod").ZodOptional<import("zod").ZodBoolean>;
                emitSpeakerVad: import("zod").ZodOptional<import("zod").ZodBoolean>;
                diarizationThreshold: import("zod").ZodOptional<import("zod").ZodNumber>;
                diarizationMinSegmentMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                spkCacheEnable: import("zod").ZodOptional<import("zod").ZodBoolean>;
                spkCacheLen: import("zod").ZodOptional<import("zod").ZodNumber>;
                fifoLen: import("zod").ZodOptional<import("zod").ZodNumber>;
                chunkLeftContextMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                chunkRightContextMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                spkCacheUpdatePeriod: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
            text: import("zod").ZodOptional<import("zod").ZodString>;
            done: import("zod").ZodOptional<import("zod").ZodBoolean>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                audioDuration: import("zod").ZodOptional<import("zod").ZodNumber>;
                realTimeFactor: import("zod").ZodOptional<import("zod").ZodNumber>;
                tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalSegments: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperEncodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperDecodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                decoderTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                melSpecTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendDevice: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendId: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuUnsupported: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuMemTotalMb: import("zod").ZodOptional<import("zod").ZodNumber>;
                gpuMemFreeMb: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalWallMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalSamples: import("zod").ZodOptional<import("zod").ZodNumber>;
                processCalls: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperSampleMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperBatchdMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                whisperPromptMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTranscriptions: import("zod").ZodOptional<import("zod").ZodNumber>;
                modelLoadMs: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalEncodedFrames: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderOnCoreml: import("zod").ZodOptional<import("zod").ZodNumber>;
                encoderUsedCoreml: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            error: import("zod").ZodOptional<import("zod").ZodString>;
            segment: import("zod").ZodOptional<import("zod").ZodObject<{
                text: import("zod").ZodString;
                startMs: import("zod").ZodNumber;
                endMs: import("zod").ZodNumber;
                append: import("zod").ZodBoolean;
                id: import("zod").ZodNumber;
                speakerId: import("zod").ZodOptional<import("zod").ZodNumber>;
                speaker: import("zod").ZodOptional<import("zod").ZodString>;
                speakerSegments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    speakerId: import("zod").ZodNumber;
                    startMs: import("zod").ZodNumber;
                    endMs: import("zod").ZodNumber;
                }, import("zod/v4/core").$strip>>>;
                isEndOfTurn: import("zod").ZodOptional<import("zod").ZodBoolean>;
                startsWord: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod/v4/core").$strip>>;
            vad: import("zod").ZodOptional<import("zod").ZodObject<{
                speakerId: import("zod").ZodOptional<import("zod").ZodNumber>;
                speaking: import("zod").ZodBoolean;
                probability: import("zod").ZodNumber;
                source: import("zod").ZodOptional<import("zod").ZodEnum<{
                    silero: "silero";
                    energy: "energy";
                    sortformer: "sortformer";
                }>>;
            }, import("zod/v4/core").$strip>>;
            endOfTurn: import("zod").ZodOptional<import("zod").ZodPreprocess<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                source: import("zod").ZodLiteral<"whisper">;
                silenceDurationMs: import("zod").ZodNumber;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                source: import("zod").ZodLiteral<"parakeet">;
            }, import("zod/v4/core").$strip>], "source">, unknown>>;
            diagnostics: import("zod").ZodOptional<import("zod").ZodObject<{
                selectedBackend: import("zod").ZodString;
                selectedDevice: import("zod").ZodEnum<{
                    cpu: "cpu";
                    gpu: "gpu";
                }>;
                graphicsApi: import("zod").ZodOptional<import("zod").ZodEnum<{
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
                driver: import("zod").ZodOptional<import("zod").ZodObject<{
                    name: import("zod").ZodString;
                    version: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
                gpuId: import("zod").ZodOptional<import("zod").ZodString>;
                fallback: import("zod").ZodOptional<import("zod").ZodObject<{
                    requestedBackend: import("zod").ZodOptional<import("zod").ZodString>;
                    requestedDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                        cpu: "cpu";
                        gpu: "gpu";
                    }>>;
                    reason: import("zod").ZodString;
                }, import("zod/v4/core").$strip>>;
                probe: import("zod").ZodOptional<import("zod").ZodObject<{
                    status: import("zod").ZodEnum<{
                        unknown: "unknown";
                        compatible: "compatible";
                        incompatible: "incompatible";
                    }>;
                    backend: import("zod").ZodString;
                    reason: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
            }, import("zod/v4/core").$strip>>;
            type: import("zod").ZodLiteral<"transcribeStream">;
        }, import("zod/v4/core").$strip>>;
    };
    logging: {
        module: () => Promise<typeof import("@qvac/asr-ggml/addonLogging")>;
        namespace: "@qvac/asr-ggml";
    };
};
