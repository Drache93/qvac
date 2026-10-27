import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { ModelHost, TrackedLoad } from '../../lib/contract/models.ts';
import type { TranslationService } from '../../lib/contract/translation.ts';
import type { ModelSrc } from '../../lib/models/context.ts';
import type { HoldFn } from '../../lib/contract/models.ts';
import { type ModelRegistrySdk } from '../../lib/models/model-source.ts';
import { type NmtPlan } from './nmt-catalog.ts';
interface BergamotConfig {
    engine: 'Bergamot';
    from: string;
    to: string;
    pivotModel?: {
        modelSrc: ModelSrc;
    };
    srcVocabSrc?: string;
    dstVocabSrc?: string;
}
export type TranslationSdk = ModelRegistrySdk & {
    loadModel(params: {
        modelSrc: ModelSrc;
        modelType: 'nmtcpp-translation';
        modelConfig: BergamotConfig;
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
    unloadModel(params: {
        modelId: string;
    }): Promise<unknown>;
    cancel?(params: {
        requestId: string;
    }): Promise<void>;
    translate(params: {
        modelId: string;
        text: string;
        stream: false;
        modelType: 'nmt';
    } | {
        modelId: string;
        text: string;
        from: string;
        to: string;
        stream: false;
        modelType: 'llm';
    }): {
        text: Promise<string>;
    };
};
export declare const TRANSLATION_LOAD_STALL_MS: number;
export interface TranslationRuntimeOptions {
    loadSdk: () => Promise<TranslationSdk>;
    loads?: Pick<ModelHost, 'track'>;
    onProgress?: (model: string, progress: Record<string, unknown>) => void;
    hold?: HoldFn;
    stallMs?: number;
}
export interface TranslationRuntime {
    loadSdk: () => Promise<TranslationSdk>;
    ensureLoaded: (sdk: TranslationSdk, plan: NmtPlan, signal?: BareAbortSignal) => Promise<{
        modelId: string;
    }>;
    unload: () => Promise<void>;
    unloadIdle: () => Promise<void>;
    enter: (signal?: BareAbortSignal) => Promise<void>;
    exit: () => void;
}
export declare function createTranslationRuntime({ loadSdk, loads, onProgress, hold, stallMs }: TranslationRuntimeOptions): TranslationRuntime;
export type SlmTranslateFn = (model: string, params: {
    text: string;
    from: string;
    to: string;
}, signal?: BareAbortSignal) => Promise<string>;
export declare function stripLanguageLabel(text: string, ...codes: string[]): Promise<string>;
export interface TranslateArgs {
    text: string;
    to: string;
    from?: string;
}
export interface TranslateError {
    error: string;
}
export declare function parseTranslateArgs(args: Record<string, unknown>): TranslateArgs | TranslateError;
export declare function sourceLanguage(text: string, from?: string): Promise<string | TranslateError>;
export interface TranslateToolOptions {
    slm?: SlmTranslateFn;
}
export type TranslateFn = TranslationService['translate'];
export declare function createTranslate(runtime: TranslationRuntime, { slm }?: TranslateToolOptions): TranslateFn;
export declare function createTranslateTool(runtime: TranslationRuntime, options?: TranslateToolOptions): ToolDefinition;
export {};
