// Public API exports only
export { batchCompletion, completion, deleteCache, loadModel, downloadAsset, heartbeat, unloadModel, transcribe, transcribeStream, bciTranscribe, bciTranscribeStream, embed, finetune, translate, cancel, ragChunk, ragIngest, ragSaveEmbeddings, ragSearch, ragDeleteEmbeddings, ragReindex, ragListWorkspaces, ragCloseWorkspace, ragDeleteWorkspace, createVectorIndex, loadVectorIndex, textToSpeech, textToSpeechStream, getModelInfo, getLoadedModelInfo, startRpcServer, stopRpcServer, discoverRpcServers, getSystemResources, assessModelFit, loggingStream, subscribeServerLogs, ocr, invokePlugin, invokePluginStream, diffusion, classify, decide, rerank, video, upscale, worldCreateScene, worldStep, modelRegistryList, modelRegistrySearch, modelRegistryGetModel, suspend, resume, state, vla, vlaHparams, vlaSetEmbodiment, vlaPreprocessImage, vlaPadState, VLA_DEFAULT_IMAGE_SIZE, audioGen, audioEdit, audioUnderstand } from './client/api/index.js';
export { close } from './client/index.js';
export { plugins } from './client/plugins-factory.js';
export { VERBOSITY, ASR_BACKEND_IDS, TTS_ENGINES, TTS_PARLER_EMOTIONS, TTS_PACES, TTS_SENTENCE_DELIMITER_PRESETS, TTS_CHATTERBOX_LANGUAGES, TTS_SUPERTONIC_LANGUAGES, TTS_COSYVOICE3_EMOTIONS, TTS_COSYVOICE3_INSTRUCT_DIALECTS, TTS_COSYVOICE3_INSTRUCT_VOLUMES, TTS_COSYVOICE3_INSTRUCT_STYLES, RAG_ERROR_CODES, VectorIndexStorage, DEFAULT_VECTOR_INDEX_STORAGE, toolSchema, TOOL_SEARCH_NAME, buildToolSearchTool, executeToolSearch, loadedToolNames, searchDeferredTools, AUDIOGEN_ENGINES, AUDIOGEN_TASK_TYPES, AUDIOGEN_TRACKS, AUDIOGEN_INPUT_SAMPLE_RATE, AUDIOGEN_INPUT_CHANNELS, AUDIOGEN_INPUT_MAX_SECONDS, AUDIOGEN_MAX_AUDIO_CODES, AUDIOGEN_EDIT_OPERATIONS, AUDIOGEN_REPAINT_MODES, definePlugin, defineHandler, defineDuplexHandler, PluginDefinitionInvalidError } from '@qvac/inference/surface';
// SDK-owned error-code objects: `SDK_CLIENT_ERROR_CODES` holds transport/client
// codes absent from @qvac/inference, and `SDK_SERVER_ERROR_CODES` carries the
// client-side error definitions (`addCodes` message registry) that
// @qvac/inference's value-clean surface does not provide.
export { SDK_CLIENT_ERROR_CODES } from './schemas/sdk-errors-client.js';
export { SDK_SERVER_ERROR_CODES } from './schemas/sdk-errors-server.js';
// Built-in plugin ids under the public @qvac/sdk name (see `@/plugin-ids`).
export { PLUGIN_LLM, PLUGIN_EMBEDDING, PLUGIN_DECISION, PLUGIN_RERANK, PLUGIN_WHISPER, PLUGIN_BCI, PLUGIN_MOSS_TRANSCRIBE, PLUGIN_NMT, PLUGIN_TTS, PLUGIN_OCR, PLUGIN_DIFFUSION, PLUGIN_AUDIOGEN, PLUGIN_VLA, PLUGIN_CLASSIFICATION, SDK_DEFAULT_PLUGINS } from './plugin-ids.js';
export {} from './utils/tool-helpers.js';
// Model types - canonical naming with backward-compatible aliases
export { MODEL_TYPES, ModelType } from '@qvac/inference/surface';
// Model registry constants
export * from '@qvac/inference/models';
export { SUPPORTED_AUDIO_FORMATS } from '@qvac/inference/surface';
// Error classes that clients need for `instanceof` checks on rejected
// promises. `InferenceCancelledError` rides the standard `QvacError`
// envelope, but consumers reach for it through `instanceof` on
// `await run.final` / `run.text` / `run.toolCalls` / `run.stats`
// rejections. `RequestRejectedByPolicyError` is thrown by
// `await RequestRegistry.begin(...)` when a registered concurrency policy
// refuses a new request. A same-model `completion` doesn't reject — it waits
// FIFO — so this surfaces only when the per-model wait queue is already at its
// `maxQueueDepthPerModel` cap. It propagates out through the worker so the
// client can distinguish "the model is saturated" from "the request failed".
//
// `RequestIdConflictError` and `RequestNotFoundError` are thrown by
// `await RequestRegistry.begin(...)` / `.end(...)` on UUID collisions and
// missing-target cancels. They're surfaced here so consumers using
// the decorated-promise `requestId` can pattern-match on rejected
// cancel paths. All three classes round-trip the RPC boundary via
// the typed-error reconstructor in `client/rpc/rpc-error.ts` so
// `err instanceof <Class>` works on the consumer side, not just on
// the worker side.
export { InferenceCancelledError } from './utils/errors-server.js';
export { ContextOverflowError, RequestIdConflictError, RequestNotFoundError, RequestRejectedByPolicyError, TranslationFailedError } from './utils/errors-server.js';
// `WorkerCrashedError` and `WorkerShutdownError` are thrown by the
// rpc-client life-signal race when the bare worker exits unexpectedly
// or close()/process-exit teardown runs while a caller is in flight.
// `WorkerStartupError` is the pre-handshake counterpart: it is never thrown
// directly, it is the `cause` of `RPCInitTimeoutError`, and it carries
// `workerExited` / `exitCode` / `exitSignal` / `stderrTail` so a host can tell a
// crashed worker from a slow one without parsing the message.
// `BareRuntimeBinaryNotFoundError` is thrown when the worker fails to
// spawn because the platform's `bare-runtime-<platform>-<arch>` package is
// missing (common under pnpm). Exported so consumers can pattern-match with
// `instanceof`.
// `StreamEndedError` is raised by the streaming result helpers (upscale, world)
// when the RPC stream closes without a terminal `done` frame. Exported for the
// same reason as the rest of this block: matching on it requires the class.
// `TextToSpeechStreamFailedError` is what `textToSpeech()` throws for an
// invalid stream/sentenceStream combination, and what the duplex TTS session
// throws on a write after end — its own JSDoc named it long before it was
// exported.
export { BareRuntimeBinaryNotFoundError, WorkerCrashedError, WorkerShutdownError, WorkerStartupError, RequestValidationFailedError, StreamEndedError, TextToSpeechStreamFailedError } from './utils/errors-client.js';
// Logging exports
export { getLogger, SDK_LOG_ID, SDK_ALL_LOG_ID } from './logging/index.js';
// Profiler exports
export { profiler, attachBackendDiagnostics } from '@qvac/inference/surface';
export { RpcServerOperationError } from './utils/errors-server.js';
export { getRpcDeviceMap } from '@qvac/inference/surface';
