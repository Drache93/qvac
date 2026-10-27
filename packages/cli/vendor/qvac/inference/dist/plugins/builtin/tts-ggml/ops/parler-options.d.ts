import type { TextToSpeechStreamRequest, TtsRequest } from '../../../../schemas/index.js';
export type ParlerJobOptions = Pick<TtsRequest, 'description' | 'voiceDescription' | 'voice' | 'emotion' | 'pitch' | 'pace' | 'expressivity' | 'noise' | 'reverb' | 'quality'>;
type ParlerJobOptionsRequest = TtsRequest | TextToSpeechStreamRequest;
/** The loaded addon's engine (`TTSGgml#getEngineType()`), when it reports one. */
export declare function getTtsEngineType(model: unknown): string | undefined;
export declare function getParlerJobOptions(request: ParlerJobOptionsRequest): ParlerJobOptions;
export declare function assertParlerJobOptionsSupported(model: unknown, options: ParlerJobOptions, handlerName: 'textToSpeech' | 'textToSpeechStream'): void;
export {};
