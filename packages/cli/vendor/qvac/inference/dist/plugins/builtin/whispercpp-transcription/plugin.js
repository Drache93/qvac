import ASRGgml from '@qvac/asr-ggml';
import { definePlugin, defineHandler, defineDuplexHandler, transcribeRequestSchema, transcribeResponseSchema, transcribeStreamRequestSchema, transcribeStreamResponseSchema, ModelType, whisperConfigSchema, ADDON_ASR } from '../../../schemas/index.js';
import { transcribe, transcribeStream } from '../../ops/transcribe.js';
import { attachModelExecutionMs } from '../../../profiling/model-execution.js';
import { attachBackendDiagnostics } from '../../../profiling/backend-diagnostics.js';
import { buildWhisperEngineConfig } from '../asr-ggml/config.js';
import { createAsrModelLogger } from '../asr-ggml/logging.js';
function createWhisperModel(modelId, modelPath, whisperConfig, vadModelPath) {
    const logger = createAsrModelLogger(modelId, ModelType.whispercppTranscription);
    const model = new ASRGgml({
        files: {
            model: modelPath,
            ...(vadModelPath && { vadModel: vadModelPath })
        },
        config: buildWhisperEngineConfig(whisperConfig),
        enableStats: true,
        logger
    });
    return { model };
}
export const whisperPlugin = definePlugin({
    modelType: ModelType.whispercppTranscription,
    displayName: 'Whisper (whisper.cpp)',
    addonPackage: ADDON_ASR,
    loadConfigSchema: whisperConfigSchema,
    assessFit: ASRGgml.assessFit,
    async resolveConfig(cfg, ctx) {
        const { vadModelSrc, ...whisperConfig } = cfg;
        if (!vadModelSrc) {
            return { config: whisperConfig };
        }
        const vadModelPath = await ctx.resolveModelPath(vadModelSrc);
        return {
            config: whisperConfig,
            artifacts: { vadModelPath }
        };
    },
    createModel(params) {
        const whisperConfig = (params.modelConfig ?? {});
        const { model } = createWhisperModel(params.modelId, params.modelPath, whisperConfig, params.artifacts?.['vadModelPath']);
        return { model };
    },
    handlers: {
        transcribe: defineHandler({
            requestSchema: transcribeRequestSchema,
            responseSchema: transcribeResponseSchema,
            streaming: true,
            // whisper.cpp addon exposes a model-wide hard cancel — compute
            // is interrupted on the currently-running transcription.
            cancel: { scope: 'model', hard: true },
            handler: async function* (request) {
                const metadata = request.metadata === true;
                const stream = metadata
                    ? transcribe({
                        modelId: request.modelId,
                        audioChunk: request.audioChunk,
                        prompt: request.prompt,
                        hotwords: request.hotwords,
                        maxNewTokens: request.maxNewTokens,
                        metadata: true
                    }, request.requestId)
                    : transcribe({
                        modelId: request.modelId,
                        audioChunk: request.audioChunk,
                        prompt: request.prompt,
                        hotwords: request.hotwords,
                        maxNewTokens: request.maxNewTokens
                    }, request.requestId);
                try {
                    let result = await stream.next();
                    while (!result.done) {
                        yield metadata
                            ? {
                                type: 'transcribe',
                                segment: result.value
                            }
                            : {
                                type: 'transcribe',
                                text: result.value
                            };
                        result = await stream.next();
                    }
                    const { modelExecutionMs, stats, diagnostics } = result.value;
                    // The field is what reaches an RPC client; the symbol is what the
                    // profiling layer reads to set `event.backend`, as audiogen does.
                    const terminal = attachModelExecutionMs({
                        type: 'transcribe',
                        text: '',
                        done: true,
                        ...(stats && { stats }),
                        ...(diagnostics && { diagnostics })
                    }, modelExecutionMs);
                    yield diagnostics ? attachBackendDiagnostics(terminal, diagnostics) : terminal;
                }
                finally {
                    await stream.return?.(undefined);
                }
            }
        }),
        transcribeStream: defineDuplexHandler({
            requestSchema: transcribeStreamRequestSchema,
            responseSchema: transcribeStreamResponseSchema,
            streaming: true,
            duplex: true,
            // Same model-wide hard cancel surface as `transcribe` — both
            // route through the whisper.cpp addon.
            cancel: { scope: 'model', hard: true },
            handler: async function* (request, inputStream) {
                const streamOpts = {
                    ...(request.emitVadEvents !== undefined && {
                        emitVadEvents: request.emitVadEvents
                    }),
                    ...(request.endOfTurnSilenceMs !== undefined && {
                        endOfTurnSilenceMs: request.endOfTurnSilenceMs
                    }),
                    ...(request.vadRunIntervalMs !== undefined && {
                        vadRunIntervalMs: request.vadRunIntervalMs
                    })
                };
                const metadata = request.metadata === true;
                const iterator = metadata
                    ? transcribeStream(request.modelId, inputStream, request.prompt, true, streamOpts, request.requestId)
                    : transcribeStream(request.modelId, inputStream, request.prompt, false, streamOpts, request.requestId);
                try {
                    let result = await iterator.next();
                    while (!result.done) {
                        const value = result.value;
                        if (typeof value === 'object' && value !== null && 'type' in value) {
                            if (value.type === 'vad') {
                                yield {
                                    type: 'transcribeStream',
                                    vad: {
                                        speaking: value.speaking,
                                        probability: value.probability,
                                        ...(value.source && { source: value.source })
                                    }
                                };
                                result = await iterator.next();
                                continue;
                            }
                            if (value.type === 'endOfTurn') {
                                // The shared ASR op normalizes addon engine sources to the
                                // stable engine-level Whisper/Parakeet variants.
                                if (value.source !== 'parakeet' && typeof value.silenceDurationMs === 'number') {
                                    yield {
                                        type: 'transcribeStream',
                                        endOfTurn: {
                                            source: 'whisper',
                                            silenceDurationMs: value.silenceDurationMs
                                        }
                                    };
                                }
                                result = await iterator.next();
                                continue;
                            }
                            result = await iterator.next();
                            continue;
                        }
                        yield metadata
                            ? {
                                type: 'transcribeStream',
                                segment: value
                            }
                            : {
                                type: 'transcribeStream',
                                text: value
                            };
                        result = await iterator.next();
                    }
                    const { modelExecutionMs, stats, diagnostics } = result.value;
                    // The field is what reaches an RPC client; the symbol is what the
                    // profiling layer reads to set `event.backend`, as audiogen does.
                    const terminal = attachModelExecutionMs({
                        type: 'transcribeStream',
                        text: '',
                        done: true,
                        ...(stats && { stats }),
                        ...(diagnostics && { diagnostics })
                    }, modelExecutionMs);
                    yield diagnostics ? attachBackendDiagnostics(terminal, diagnostics) : terminal;
                }
                finally {
                    await iterator.return?.(undefined);
                }
            }
        })
    },
    logging: {
        module: () => import('@qvac/asr-ggml/addonLogging'),
        namespace: ADDON_ASR
    }
});
