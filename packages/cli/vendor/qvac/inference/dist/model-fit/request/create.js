import { ModelType } from '../../schemas/index.js';
import { createBciFitRequest, createMossTranscribeFitRequest, createParakeetFitRequest, createWhisperFitRequest } from './engines/asr.js';
import { createAudiogenFitRequest } from './engines/audiogen.js';
import { createDiffusionFitRequest } from './engines/diffusion.js';
import { createLlamaFitRequest, llamaLoadKindFor } from './engines/llama.js';
import { createNmtFitRequest } from './engines/nmt.js';
import { createOcrFitRequest } from './engines/ocr.js';
import { createTtsFitRequest } from './engines/tts.js';
/**
 * Builds a fit request from the same resolved config and artifacts the real
 * load is about to use, or explains why this load cannot be answered for.
 *
 * Structural shapes the SDK owns — a load with no fitter behind it, a companion
 * set that did not resolve, a setting whose effect on the projection is unknown
 * — are refused here so no engine is asked a question it cannot answer.
 * Value-level policy stays inside each engine's own fitter.
 */
export function createFitRequest(params) {
    const { modelType, modelPath, modelConfig, artifacts, marginBytes } = params;
    if (params.transcriptionWorkload !== undefined && modelType !== ModelType.mossTranscribe) {
        return {
            supported: false,
            detail: 'transcriptionWorkload is supported only for MOSS transcription'
        };
    }
    // Every engine reads whole files rather than a shard set, so a split model is
    // not a shape any of them can be pointed at.
    if (params.isShardedModel) {
        return { supported: false, detail: 'sharded models are not representable' };
    }
    const loadKind = llamaLoadKindFor(modelType);
    if (loadKind !== undefined) {
        return createLlamaFitRequest({ loadKind, modelPath, modelConfig, artifacts, marginBytes });
    }
    const common = { modelPath, modelConfig, artifacts, marginBytes };
    switch (modelType) {
        case ModelType.mossTranscribe:
            return createMossTranscribeFitRequest({
                ...common,
                transcriptionWorkload: params.transcriptionWorkload
            });
        case ModelType.whispercppTranscription:
            return createWhisperFitRequest(common);
        case ModelType.parakeetTranscription:
            return createParakeetFitRequest(common);
        case ModelType.bciWhispercppTranscription:
            return createBciFitRequest(common);
        case ModelType.ttsGgml:
            return createTtsFitRequest({ ...common, ttsWorkload: params.ttsWorkload });
        case ModelType.audiogenGgml:
            return createAudiogenFitRequest(common);
        case ModelType.sdcppGeneration:
            return createDiffusionFitRequest({ modelPath, modelConfig, artifacts });
        case ModelType.ggmlOcr:
            return createOcrFitRequest(common);
        case ModelType.nmtcppTranslation:
            return createNmtFitRequest(common);
        default:
            return { supported: false, detail: `no fitter for model type: ${modelType}` };
    }
}
