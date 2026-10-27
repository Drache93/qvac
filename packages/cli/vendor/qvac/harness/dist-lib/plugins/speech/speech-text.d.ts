import { type SpeechLang } from './speech-lexicon.ts';
export interface SpeechText {
    text: string;
    dropped: string[];
}
export declare function normalizeForSpeech(text: string, lang?: SpeechLang): SpeechText;
export declare function normalizeForMoss(text: string, lang?: SpeechLang): SpeechText;
