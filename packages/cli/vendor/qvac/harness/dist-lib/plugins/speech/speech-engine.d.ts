import { categoryModelConfig, type CapabilityProfile } from '../../lib/models/model-catalog.ts';
export type TtsEngine = 'supertonic' | 'moss';
export interface SpeechSpeaker {
    audio: string;
    transcript: string;
}
export interface SpeechDialogue {
    backbone: string;
    speakers: SpeechSpeaker[];
}
export interface SpeechOptions {
    tts?: TtsEngine;
    voice?: string;
    dialogue?: SpeechDialogue;
}
type ModelSrc = Parameters<typeof categoryModelConfig>[0];
export declare function invalidOptions({ tts, voice, dialogue }: SpeechOptions): string | null;
export declare function defaultTts({ tts, dialogue }: SpeechOptions, profile: CapabilityProfile | null): string;
export declare function isDialogue({ dialogue }: SpeechOptions, src: string): boolean;
export declare function engineOf(options: SpeechOptions, src: string): TtsEngine;
export declare function dialogueScript({ dialogue }: SpeechOptions, text: string): string;
export declare function loadConfig({ voice, dialogue }: SpeechOptions, modelSrc: ModelSrc): Readonly<Record<string, unknown>>;
export {};
