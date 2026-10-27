import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompletionSdk } from '../contract/index.ts';
export type EnhanceMode = 'never' | 'auto';
export interface EnhanceResult {
    text: string;
    model: string;
    totalTokens?: number;
}
export type Enhancer = (prompt: string, signal?: BareAbortSignal) => Promise<EnhanceResult | null>;
export interface ExpandImagePromptOptions {
    modelId: string;
    model: string;
    signal?: BareAbortSignal | undefined;
}
export declare function expandImagePrompt(sdk: CompletionSdk, prompt: string, options: ExpandImagePromptOptions): Promise<EnhanceResult | null>;
