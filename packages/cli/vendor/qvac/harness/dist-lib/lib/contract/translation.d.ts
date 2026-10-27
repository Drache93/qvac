import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export interface TranslationRequest {
    text: string;
    to: string;
    from?: string | undefined;
}
export interface Translation {
    text: string;
    from: string;
    to: string;
    engine: 'nmt' | 'slm' | 'none';
    model?: string;
    pivoted?: boolean;
}
export interface TranslationRefused {
    error: string;
}
export interface TranslationService {
    translate(request: TranslationRequest, signal?: BareAbortSignal): Promise<Translation | TranslationRefused>;
}
