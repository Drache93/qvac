import { type Registry } from './content.ts';
export declare const MODEL_TASK_TYPES: readonly ['llm', 'embeddings', 'speech-to-text', 'text-to-speech', 'image-generation', 'audio-generation', 'translation', 'text-recognition', 'other'];
export declare const INDEXING_FAILURES: readonly ['empty', 'no-text', 'password-protected', 'out-of-space', 'unsupported', 'failed'];
export declare function registerEngineTypes(ns: Registry): void;
export declare function registerEngineApi(api: Registry): void;
