import { type ModelRegistryEngine, type ModelRegistryEntryAddon } from './registry.js';
export declare const ENGINE_TO_ADDON: {
    readonly "llamacpp-completion": "llm";
    readonly "whispercpp-transcription": "whisper";
    readonly "bci-whispercpp-transcription": "bci";
    readonly "llamacpp-embedding": "embeddings";
    readonly "llamacpp-decision": "embeddings";
    readonly "llamacpp-rerank": "embeddings";
    readonly "nmtcpp-translation": "nmt";
    readonly "onnx-tts": "tts";
    readonly "tts-ggml": "tts";
    readonly "ggml-ocr": "ocr";
    readonly "parakeet-transcription": "parakeet";
    readonly "moss-transcribe": "moss-transcribe";
    readonly "sdcpp-generation": "diffusion";
    readonly "audiogen-ggml": "audiogen";
    readonly "ggml-vla": "vla";
    readonly "ggml-classification": "classification";
    readonly 'onnx-vad': "vad";
};
export declare const LEGACY_ENGINE_TO_CANONICAL: Record<string, ModelRegistryEngine>;
export declare const LEGACY_REGISTRY_ENGINE_RULES: Record<string, readonly {
    tag: string;
    engine: ModelRegistryEngine;
}[]>;
export declare function resolveCanonicalEngine(engine: string): ModelRegistryEngine | null;
export declare function resolveRegistryEngine(engine: string, tags?: readonly string[]): ModelRegistryEngine | null;
export declare function getAddonFromEngine(engine: ModelRegistryEngine): ModelRegistryEntryAddon;
