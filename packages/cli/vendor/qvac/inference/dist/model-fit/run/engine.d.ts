import type { AsrFitRequest, AsrFitResult } from '@qvac/asr-ggml';
import type { AudiogenFitRequest, AudiogenFitResult } from '@qvac/audiogen-ggml';
import type { BciFitRequest, BciFitResult } from '@qvac/bci-whispercpp';
import type { DiffusionFitRequest, DiffusionFitResult, EsrganFitRequest, WorldFitRequest } from '@qvac/diffusion-cpp';
import type { EmbedFitRequest, EmbedFitResult } from '@qvac/embed-llamacpp';
import type LlmLlamacpp from '@qvac/llm-llamacpp';
import type { OcrFitRequest, OcrFitResult } from '@qvac/ocr-ggml';
import type TranslationNmtcpp from '@qvac/translation-nmtcpp';
import type { TtsFitRequest, TtsFitResult } from '@qvac/tts-ggml';
/**
 * The engine packages each expose their own `assessFit`, taking the same fields
 * their loader takes and returning the figures their fitter measures.
 */
export type FitProbeRequest = {
    engine: 'llm-llamacpp';
    request: LlmLlamacpp.FitRequest;
} | {
    engine: 'embed-llamacpp';
    request: EmbedFitRequest;
} | {
    engine: 'asr-ggml';
    request: AsrFitRequest;
} | {
    engine: 'bci-whispercpp';
    request: BciFitRequest;
} | {
    engine: 'tts-ggml';
    request: TtsFitRequest;
} | {
    engine: 'audiogen-ggml';
    request: AudiogenFitRequest;
} | {
    engine: 'diffusion-cpp';
    request: DiffusionFitRequest | EsrganFitRequest | WorldFitRequest;
} | {
    engine: 'ocr-ggml';
    request: OcrFitRequest;
} | {
    engine: 'translation-nmtcpp';
    request: TranslationNmtcpp.FitRequest;
};
export type FitProbeEngine = FitProbeRequest['engine'];
export type FitProbeResult = {
    engine: 'llm-llamacpp';
    result: LlmLlamacpp.FitResult;
} | {
    engine: 'embed-llamacpp';
    result: EmbedFitResult;
} | {
    engine: 'asr-ggml';
    result: AsrFitResult;
} | {
    engine: 'bci-whispercpp';
    result: BciFitResult;
} | {
    engine: 'tts-ggml';
    result: TtsFitResult;
} | {
    engine: 'audiogen-ggml';
    result: AudiogenFitResult;
} | {
    engine: 'diffusion-cpp';
    result: DiffusionFitResult;
} | {
    engine: 'ocr-ggml';
    result: OcrFitResult;
} | {
    engine: 'translation-nmtcpp';
    result: TranslationNmtcpp.FitResult;
};
/** Calls one engine's fitter, taken from the plugin that owns its addon. */
export declare function callEngineFit(probe: FitProbeRequest): Promise<FitProbeResult>;
