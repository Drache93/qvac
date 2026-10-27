import type ASRGgml from '@qvac/asr-ggml';
import type { ParakeetConfig, WhisperConfig, MossTranscribeConfig } from '../../../schemas/index.js';
export declare function buildWhisperEngineConfig(config: WhisperConfig): {
    miscConfig?: {
        [k: string]: unknown;
    };
    contextParams?: {
        [k: string]: unknown;
    };
    engine: "whisper";
    whisperConfig: ASRGgml.WhisperConfig;
};
export declare function buildParakeetEngineConfig(config: ParakeetConfig): {
    engine: "parakeet";
    parakeetConfig: {
        [k: string]: unknown;
    };
};
export declare function buildWhisperReloadConfig(config: WhisperConfig): {
    miscConfig?: {
        [k: string]: unknown;
    };
    whisperConfig: {
        [k: string]: unknown;
    };
};
export declare function buildParakeetReloadConfig(config: ParakeetConfig): {
    parakeetConfig: {
        [k: string]: unknown;
    };
};
export declare function buildMossTranscribeEngineConfig(config: MossTranscribeConfig): {
    engine: "moss-transcribe";
    mossTranscribeConfig: {
        [k: string]: unknown;
    };
};
