export { COMPACTION_MIN_CTX_SIZE, contextOptionsForModel, DEFAULT_CONTEXT_SIZE, defaultContextForModel, formatTokenCount, MODEL_CONTEXT_TARGET, maxContextForModel, modelContextTargetForPlatform } from './model-context.js';
export const PENDING_BLOB_REFERENCE = '{"pending":true}';
export const CANCELED_CHAT_MESSAGE = 'Stopped the current run. Send a follow-up to steer the next step.';
export const HOMEBREW_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
export const SAFE_BIN_NAME = /^[A-Za-z0-9._-]+$/;
export const MODEL_IDLE_UNLOAD_KEY = 'model.idleUnloadMinutes';
export const MODEL_IDLE_UNLOAD_MINUTES = [
    15, 30, 60, 120, 240, 480, 720, 1440
];
export const MODEL_MEMORY_CAP_KEY = 'model.memoryCapPercent';
export const MODEL_MEMORY_CAP_DEFAULT = 85;
export const MODEL_MEMORY_CAP_MIN = 10;
export const MODEL_MEMORY_CAP_MAX = 100;
export const FAKE_MODELS_KEY = 'debug.fakeModels';
export const QUACK_MODEL = 'quack';
