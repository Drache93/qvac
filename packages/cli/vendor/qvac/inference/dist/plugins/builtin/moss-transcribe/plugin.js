import ASRGgml from '@qvac/asr-ggml';
import { definePlugin, defineHandler, transcribeRequestSchema, transcribeResponseSchema, ModelType, mossTranscribeConfigSchema, ADDON_ASR } from '../../../schemas/index.js';
import { ModelLoadFailedError } from '../../../errors/index.js';
import { transcribe } from '../../ops/transcribe.js';
import { attachModelExecutionMs } from '../../../profiling/model-execution.js';
import { attachBackendDiagnostics } from '../../../profiling/backend-diagnostics.js';
import { buildMossTranscribeEngineConfig } from '../asr-ggml/config.js';
import { createAsrModelLogger } from '../asr-ggml/logging.js';
function createMossTranscribeModel(params) {
    const config = (params.modelConfig ?? {});
    const modelPath = params.modelPath;
    if (!modelPath) {
        throw new ModelLoadFailedError('MOSS-Transcribe-Diarize requires a GGUF model source');
    }
    const logger = createAsrModelLogger(params.modelId, ModelType.mossTranscribe);
    const model = new ASRGgml({
        files: { model: modelPath },
        config: buildMossTranscribeEngineConfig(config),
        enableStats: true,
        logger
    });
    return { model };
}
export const mossTranscribePlugin = definePlugin({
    modelType: ModelType.mossTranscribe,
    displayName: 'MOSS-Transcribe-Diarize',
    addonPackage: ADDON_ASR,
    loadConfigSchema: mossTranscribeConfigSchema,
    assessFit: ASRGgml.assessFit,
    resolveConfig(cfg) {
        return Promise.resolve({ config: cfg });
    },
    createModel(params) {
        return createMossTranscribeModel(params);
    },
    handlers: {
        transcribe: defineHandler({
            requestSchema: transcribeRequestSchema,
            responseSchema: transcribeResponseSchema,
            streaming: true,
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
        })
    },
    logging: {
        module: () => import('@qvac/asr-ggml/addonLogging'),
        namespace: ADDON_ASR
    }
});
