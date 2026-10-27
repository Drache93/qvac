export type TtsCapabilityProfile = 'tiny' | 'low' | 'mid' | 'high' | 'xhigh';
export declare const TTS_MODEL_NAMES: ReadonlyArray<string>;
export declare function defaultTtsModelName(profile: TtsCapabilityProfile): string;
