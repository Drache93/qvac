import BCIWhispercpp, { assessFit as bciAssessFit } from '@qvac/bci-whispercpp';
import { definePlugin, defineHandler, defineDuplexHandler, bciTranscribeRequestSchema, bciTranscribeResponseSchema, bciTranscribeStreamRequestSchema, bciTranscribeStreamResponseSchema, ModelType, bciConfigSchema, ADDON_BCI } from '../../../schemas/index.js';
import { createStreamLogger, registerAddonLogger } from '../../../logging/index.js';
import { bciTranscribe, bciTranscribeStream } from '../../ops/bci-transcribe.js';
import { attachModelExecutionMs } from '../../../profiling/model-execution.js';
import { attachBackendDiagnostics } from '../../../profiling/backend-diagnostics.js';
import { buildBciWhispercppArgs } from './args.js';
import { resolveBciConfig } from './resolve-config.js';
function createBciModel(modelId, modelPath, bciConfig, embedderPath) {
    const logger = createStreamLogger(modelId, ModelType.bciWhispercppTranscription);
    registerAddonLogger(modelId, ModelType.bciWhispercppTranscription, logger);
    const args = buildBciWhispercppArgs(modelPath, embedderPath, logger);
    const model = new BCIWhispercpp(args, bciConfig);
    return { model };
}
export const bciPlugin = definePlugin({
    modelType: ModelType.bciWhispercppTranscription,
    displayName: 'BCI (whisper.cpp)',
    addonPackage: ADDON_BCI,
    loadConfigSchema: bciConfigSchema,
    assessFit: bciAssessFit,
    resolveConfig: resolveBciConfig,
    createModel(params) {
        const bciConfig = (params.modelConfig ?? {});
        const { model } = createBciModel(params.modelId, params.modelPath, bciConfig, params.artifacts?.['embedderPath'] ?? '');
        return { model };
    },
    handlers: {
        bciTranscribe: defineHandler({
            requestSchema: bciTranscribeRequestSchema,
            responseSchema: bciTranscribeResponseSchema,
            streaming: true,
            // The BCI addon exposes a model-wide hard cancel — the running
            // neural-signal job is interrupted on `cancel()`.
            cancel: { scope: 'model', hard: true },
            handler: async function* (request) {
                const metadata = request.metadata === true;
                const stream = metadata
                    ? bciTranscribe({
                        modelId: request.modelId,
                        neuralData: request.neuralData,
                        metadata: true
                    }, request.requestId)
                    : bciTranscribe({
                        modelId: request.modelId,
                        neuralData: request.neuralData
                    }, request.requestId);
                try {
                    let result = await stream.next();
                    while (!result.done) {
                        yield metadata
                            ? {
                                type: 'bciTranscribe',
                                segment: result.value
                            }
                            : {
                                type: 'bciTranscribe',
                                text: result.value
                            };
                        result = await stream.next();
                    }
                    const { modelExecutionMs, stats, diagnostics } = result.value;
                    // The field is what reaches an RPC client; the symbol is what the
                    // profiling layer reads to set `event.backend`, as audiogen does.
                    const terminal = attachModelExecutionMs({
                        type: 'bciTranscribe',
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
        bciTranscribeStream: defineDuplexHandler({
            requestSchema: bciTranscribeStreamRequestSchema,
            responseSchema: bciTranscribeStreamResponseSchema,
            streaming: true,
            duplex: true,
            // Same model-wide hard cancel surface as `bciTranscribe` — the BCI
            // addon's `cancel()` tears down the active stream and interrupts the
            // running window job.
            cancel: { scope: 'model', hard: true },
            handler: async function* (request, inputStream) {
                const metadata = request.metadata === true;
                const iterator = metadata
                    ? bciTranscribeStream(request.modelId, inputStream, true, request.streamOpts, request.requestId)
                    : bciTranscribeStream(request.modelId, inputStream, false, request.streamOpts, request.requestId);
                // Iterated by hand rather than with `for await` so the generator's
                // return value survives: it carries the execution time the profiling
                // layer reads off the terminal frame.
                try {
                    let result = await iterator.next();
                    while (!result.done) {
                        yield metadata
                            ? {
                                type: 'bciTranscribeStream',
                                segment: result.value
                            }
                            : {
                                type: 'bciTranscribeStream',
                                text: result.value
                            };
                        result = await iterator.next();
                    }
                    // The addon reports no stats for a stream, so there is no backend
                    // verdict to attach here — only the timing.
                    yield attachModelExecutionMs({
                        type: 'bciTranscribeStream',
                        text: '',
                        done: true
                    }, result.value.modelExecutionMs);
                }
                finally {
                    await iterator.return?.(undefined);
                }
            }
        })
    },
    logging: {
        module: () => import('@qvac/bci-whispercpp/addonLogging'),
        namespace: ModelType.bciWhispercppTranscription
    }
});
