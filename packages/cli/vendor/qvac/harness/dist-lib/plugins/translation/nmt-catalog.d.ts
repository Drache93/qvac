export declare const ENGLISH = "en";
export declare const NMT_TO_ENGLISH: readonly string[];
export declare const NMT_FROM_ENGLISH: readonly string[];
export declare const SLM_MODEL = "TranslatePsy-AfriSLM-0.8B-Q4_K_M-imat";
export declare const EURONANO_LANGUAGES: readonly string[];
export declare const SLM_LANGUAGE_CODES: readonly string[];
export declare function languageLabel(code: string): string | undefined;
export declare const SLM_LANGUAGE_NAMES: ReadonlyArray<{
    code: string;
    name: string;
}>;
export declare function slmLanguage(code: string): string | undefined;
export interface NmtPlan {
    route: 'nmt';
    from: string;
    to: string;
    model: string;
    pivot?: string;
    srcVocab?: string;
    dstVocab?: string;
    tag?: string;
}
export interface SlmPlan {
    route: 'slm';
    from: string;
    to: string;
    model: string;
}
export type TranslationPlan = NmtPlan | SlmPlan;
export interface TranslationRefusal {
    error: string;
}
export declare function sameLanguage(from: string, to: string): boolean;
export declare function translationPlanFor(requestedFrom: string, requestedTo: string): TranslationPlan | TranslationRefusal;
