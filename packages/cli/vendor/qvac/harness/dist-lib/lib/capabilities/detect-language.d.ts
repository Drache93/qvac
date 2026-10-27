export interface DetectedLanguage {
    code: string;
    language: string;
    probability?: number;
}
export interface DetectLanguageContext {
    text: string;
    topK?: number;
}
export declare const UNDETERMINED = "und";
export declare function detectLanguage({ text, topK }: DetectLanguageContext): Promise<DetectedLanguage[]>;
export declare function languageName(code: string): Promise<string | null>;
