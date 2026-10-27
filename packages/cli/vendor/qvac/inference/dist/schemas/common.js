import { startRpcServerRequestSchema, startRpcServerResponseSchema, stopRpcServerRequestSchema, stopRpcServerResponseSchema, discoverRpcServersRequestSchema, discoverRpcServersResponseSchema } from './rpc-server.js';
import { z } from 'zod';
import { perCallProfilingSchema } from './profiling.js';
import { heartbeatRequestSchema, heartbeatResponseSchema } from './heartbeat.js';
import { completionOrchestrateRequestSchema, completionOrchestrateResponseSchema, completionStreamRequestSchema, completionStreamResponseSchema } from './completion-stream.js';
import { batchCompletionStreamRequestSchema, batchCompletionStreamResponseSchema } from './batch-completion-stream.js';
import { loadModelRequestSchema, loadModelResponseSchema, modelProgressUpdateSchema } from './load-model.js';
import { downloadAssetRequestSchema, downloadAssetResponseSchema } from './download-asset.js';
import { unloadModelRequestSchema, unloadModelResponseSchema, deleteCacheRequestSchema, deleteCacheResponseSchema } from './model-ops.js';
import { transcribeRequestSchema, transcribeResponseSchema, transcribeStreamRequestSchema, transcribeStreamResponseSchema } from './transcription.js';
import { bciTranscribeRequestSchema, bciTranscribeResponseSchema, bciTranscribeStreamRequestSchema, bciTranscribeStreamResponseSchema } from './bci.js';
import { embedRequestSchema, embedResponseSchema } from './embed.js';
import { cancelRequestSchema, cancelResponseSchema } from './cancel.js';
import { translateRequestSchema, translateResponseSchema } from './translate.js';
import { loggingStreamRequestSchema, loggingStreamResponseSchema } from './logging-stream.js';
import { ttsRequestSchema, ttsResponseSchema, textToSpeechStreamRequestSchema, textToSpeechStreamResponseSchema } from './text-to-speech.js';
import { errorResponseSchema } from './error.js';
import { ragRequestSchema, ragResponseSchema, ragProgressUpdateSchema } from './rag.js';
import { vectorIndexRequestSchema, vectorIndexResponseSchema } from './vector-index.js';
import { getModelInfoRequestSchema, getModelInfoResponseSchema, getLoadedModelInfoRequestSchema, getLoadedModelInfoResponseSchema } from './model-info.js';
import { getSystemResourcesRequestSchema, getSystemResourcesResponseSchema } from './system-resources.js';
import { assessModelFitRequestSchema, assessModelFitResponseSchema } from './assess-model-fit.js';
import { ocrStreamRequestSchema, ocrStreamResponseSchema } from './ocr.js';
import { diffusionStreamRequestSchema, diffusionStreamResponseSchema, videoStreamRequestSchema, videoStreamResponseSchema, upscaleStreamRequestSchema, upscaleStreamResponseSchema, worldSceneStreamRequestSchema, worldSceneStreamResponseSchema, worldStepStreamRequestSchema, worldStepStreamResponseSchema } from './sdcpp-config.js';
import { finetuneRequestSchema, finetuneResponseSchema, finetuneProgressResponseSchema } from './finetune.js';
import { pluginInvokeRequestSchema, pluginInvokeResponseSchema, pluginInvokeStreamRequestSchema, pluginInvokeStreamResponseSchema } from './plugin.js';
import { modelRegistryListRequestSchema, modelRegistryListResponseSchema, modelRegistrySearchRequestSchema, modelRegistrySearchResponseSchema, modelRegistryGetModelRequestSchema, modelRegistryGetModelResponseSchema } from './registry.js';
import { suspendRequestSchema, suspendResponseSchema, resumeRequestSchema, resumeResponseSchema, stateRequestSchema, stateResponseSchema } from './lifecycle.js';
import { decideRequestSchema, decideResponseSchema } from './decision.js';
import { rerankRequestSchema, rerankResponseSchema } from './rerank.js';
import { classifyRequestSchema, classifyResponseSchema } from './classification.js';
import { audioEditStreamRequestSchema, audioEditStreamResponseSchema, audioGenStreamRequestSchema, audioGenStreamResponseSchema, audioUnderstandRequestSchema, audioUnderstandResponseSchema } from './audio-gen.js';
export const requestSchema = z.union([
    audioGenStreamRequestSchema,
    audioEditStreamRequestSchema,
    audioUnderstandRequestSchema,
    startRpcServerRequestSchema,
    stopRpcServerRequestSchema,
    discoverRpcServersRequestSchema,
    heartbeatRequestSchema,
    loadModelRequestSchema,
    downloadAssetRequestSchema,
    completionStreamRequestSchema,
    completionOrchestrateRequestSchema,
    batchCompletionStreamRequestSchema,
    unloadModelRequestSchema,
    transcribeRequestSchema,
    transcribeStreamRequestSchema,
    bciTranscribeRequestSchema,
    bciTranscribeStreamRequestSchema,
    loggingStreamRequestSchema,
    embedRequestSchema,
    translateRequestSchema,
    ttsRequestSchema,
    textToSpeechStreamRequestSchema,
    cancelRequestSchema,
    ragRequestSchema,
    vectorIndexRequestSchema,
    deleteCacheRequestSchema,
    getModelInfoRequestSchema,
    getLoadedModelInfoRequestSchema,
    getSystemResourcesRequestSchema,
    assessModelFitRequestSchema,
    ocrStreamRequestSchema,
    diffusionStreamRequestSchema,
    videoStreamRequestSchema,
    upscaleStreamRequestSchema,
    worldSceneStreamRequestSchema,
    worldStepStreamRequestSchema,
    finetuneRequestSchema,
    pluginInvokeRequestSchema,
    pluginInvokeStreamRequestSchema,
    modelRegistryListRequestSchema,
    modelRegistrySearchRequestSchema,
    modelRegistryGetModelRequestSchema,
    suspendRequestSchema,
    resumeRequestSchema,
    stateRequestSchema,
    classifyRequestSchema,
    decideRequestSchema,
    rerankRequestSchema
]);
export const responseSchema = z.discriminatedUnion('type', [
    audioGenStreamResponseSchema,
    audioEditStreamResponseSchema,
    audioUnderstandResponseSchema,
    startRpcServerResponseSchema,
    stopRpcServerResponseSchema,
    discoverRpcServersResponseSchema,
    heartbeatResponseSchema,
    loadModelResponseSchema,
    downloadAssetResponseSchema,
    completionStreamResponseSchema,
    completionOrchestrateResponseSchema,
    batchCompletionStreamResponseSchema,
    unloadModelResponseSchema,
    modelProgressUpdateSchema,
    transcribeResponseSchema,
    transcribeStreamResponseSchema,
    bciTranscribeResponseSchema,
    bciTranscribeStreamResponseSchema,
    loggingStreamResponseSchema,
    embedResponseSchema,
    translateResponseSchema,
    ttsResponseSchema,
    textToSpeechStreamResponseSchema,
    cancelResponseSchema,
    errorResponseSchema,
    ragResponseSchema,
    ragProgressUpdateSchema,
    vectorIndexResponseSchema,
    deleteCacheResponseSchema,
    getModelInfoResponseSchema,
    getLoadedModelInfoResponseSchema,
    getSystemResourcesResponseSchema,
    assessModelFitResponseSchema,
    ocrStreamResponseSchema,
    diffusionStreamResponseSchema,
    videoStreamResponseSchema,
    upscaleStreamResponseSchema,
    worldSceneStreamResponseSchema,
    worldStepStreamResponseSchema,
    finetuneResponseSchema,
    finetuneProgressResponseSchema,
    pluginInvokeResponseSchema,
    pluginInvokeStreamResponseSchema,
    modelRegistryListResponseSchema,
    modelRegistrySearchResponseSchema,
    modelRegistryGetModelResponseSchema,
    suspendResponseSchema,
    resumeResponseSchema,
    stateResponseSchema,
    classifyResponseSchema,
    decideResponseSchema,
    rerankResponseSchema
]);
export const rpcOptionsSchema = z.object({
    timeout: z
        .number()
        .min(100)
        .optional()
        .describe('Per-call RPC timeout in milliseconds; overrides the default for this request only.'),
    healthCheckTimeout: z
        .number()
        .min(100)
        .optional()
        .describe('Timeout in milliseconds for the health-check probe that precedes the RPC call.'),
    forceNewConnection: z
        .boolean()
        .optional()
        .describe('When `true`, skip any cached RPC connection and open a fresh one for this call.'),
    profiling: perCallProfilingSchema
        .optional()
        .describe('Per-call profiler configuration; when present, overrides the global profiler settings for this request.')
});
