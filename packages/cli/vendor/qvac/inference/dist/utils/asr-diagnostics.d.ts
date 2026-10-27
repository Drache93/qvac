import type { InferenceBackendDiagnostics, TranscribeStats } from '../schemas/index.js';
/**
 * Map the whisper.cpp-family backend stats onto the shared diagnostics shape,
 * the same way the audiogen op does. Shared by the `@qvac/asr-ggml` engines
 * and `@qvac/bci-whispercpp`. `backendDevice` is the addon's own verdict:
 * `1` means it ran on the GPU, anything else means CPU.
 *
 * The engines report no fallback reason, so `fallback` is never populated —
 * unlike audiogen, a CPU run here is indistinguishable from one that never
 * asked for a GPU.
 */
export declare function buildAsrBackendDiagnostics(stats: TranscribeStats | undefined): InferenceBackendDiagnostics | undefined;
