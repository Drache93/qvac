import type { ModelAddon } from './model-source.ts';
export type ModelTaskType = 'llm' | 'embeddings' | 'speech-to-text' | 'text-to-speech' | 'image-generation' | 'audio-generation' | 'translation' | 'text-recognition' | 'other';
export declare function addonTaskType(addon: ModelAddon): ModelTaskType;
