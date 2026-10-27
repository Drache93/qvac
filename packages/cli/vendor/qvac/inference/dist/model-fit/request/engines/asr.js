import { gpuLayersFromGate } from '../gpu.js';
export function createMossTranscribeFitRequest(params) {
    if (params.transcriptionWorkload === undefined) {
        return {
            supported: false,
            detail: 'MOSS fit requires transcriptionWorkload with explicit audioSeconds'
        };
    }
    const config = (params.modelConfig ?? {});
    const workload = params.transcriptionWorkload;
    const request = {
        engine: 'moss-transcribe',
        modelPath: params.modelPath,
        audioSeconds: workload.audioSeconds,
        ...(workload.prompt !== undefined && { prompt: workload.prompt }),
        ...(workload.hotwords !== undefined && { hotwords: workload.hotwords }),
        ...(workload.maxNewTokens !== undefined && { maxNewTokens: workload.maxNewTokens }),
        gpuLayers: gpuLayersFromGate(config.useGPU),
        ...(config.maxThreads !== undefined && { threads: config.maxThreads }),
        ...(config.backendsDir !== undefined && { backendsDir: config.backendsDir }),
        ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
    };
    return { supported: true, probe: { engine: 'asr-ggml', request } };
}
/**
 * The longest single transcribe the projection has to cover. Whisper's KV cache
 * and decode graph are sized from it; unset leaves the engine's own default,
 * which is the worst case it supports.
 */
function audioSeconds(durationMs) {
    if (durationMs === undefined || durationMs <= 0)
        return undefined;
    return durationMs / 1000;
}
/**
 * Worst-case resident decoders. Each strategy carries its own count and `-1` is
 * the engine's "use the default" sentinel rather than a number of decoders.
 */
function decoderCount(candidates) {
    for (const candidate of candidates) {
        if (candidate !== undefined && candidate > 0)
            return candidate;
    }
    return undefined;
}
export function createWhisperFitRequest(params) {
    const config = (params.modelConfig ?? {});
    const vadModelPath = params.artifacts?.['vadModelPath'];
    const decoders = decoderCount([
        config.strategy === 'beam_search' ? config.beam_search_beam_size : config.greedy_best_of
    ]);
    const seconds = audioSeconds(config.duration_ms);
    const request = {
        engine: 'whisper',
        modelPath: params.modelPath,
        gpuLayers: gpuLayersFromGate(config.contextParams?.use_gpu),
        ...(vadModelPath !== undefined && { vadModelPath }),
        ...(config.contextParams?.flash_attn !== undefined && {
            flashAttn: config.contextParams.flash_attn
        }),
        ...(config.contextParams?.gpu_device !== undefined && {
            gpuDevice: config.contextParams.gpu_device
        }),
        ...(decoders !== undefined && { decoders }),
        ...(seconds !== undefined && { audioSeconds: seconds }),
        ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
    };
    return { supported: true, probe: { engine: 'asr-ggml', request } };
}
/**
 * The encoder's left context and Sortformer's rolling history size its live
 * state, and the fit request measures that state in frames while the load sets
 * it in milliseconds. Converting needs the model's frame rate, which is a
 * property of the checkpoint, so a load that pins either is refused rather than
 * projected against the engine's default window.
 */
const UNREPRESENTABLE_STREAMING = [
    'streamingLeftContextMs',
    'streamingHistoryMs'
];
export function createParakeetFitRequest(params) {
    const config = (params.modelConfig ?? {});
    if (config.streaming === true) {
        for (const key of UNREPRESENTABLE_STREAMING) {
            if (config[key] !== undefined) {
                return { supported: false, detail: `load setting the projection cannot represent: ${key}` };
            }
        }
    }
    const request = {
        engine: 'parakeet',
        modelPath: params.modelPath,
        gpuLayers: gpuLayersFromGate(config.useGPU),
        ...(config.maxThreads !== undefined && { threads: config.maxThreads }),
        // Only a streaming load holds a live session, so outside one the chunk
        // cadence describes no allocation the projection should cover.
        ...(config.streaming === true &&
            config.streamingChunkMs !== undefined && { nemotronChunkMs: config.streamingChunkMs }),
        ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
    };
    return { supported: true, probe: { engine: 'asr-ggml', request } };
}
export function createBciFitRequest(params) {
    const config = (params.modelConfig ?? {});
    const embedderPath = params.artifacts?.['embedderPath'];
    const whisper = config.whisperConfig;
    const decoders = decoderCount([whisper?.beam_search_beam_size, whisper?.greedy_best_of]);
    const seconds = audioSeconds(whisper?.duration_ms);
    return {
        supported: true,
        probe: {
            engine: 'bci-whispercpp',
            request: {
                modelPath: params.modelPath,
                ...(embedderPath !== undefined && { embedderPath }),
                gpuLayers: gpuLayersFromGate(config.contextParams?.use_gpu ?? true),
                ...(config.contextParams?.gpu_device !== undefined && {
                    gpuDevice: config.contextParams.gpu_device
                }),
                ...(decoders !== undefined && { decoders }),
                ...(seconds !== undefined && { audioSeconds: seconds }),
                ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
            }
        }
    };
}
