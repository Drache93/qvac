import type { CompletionSdk, Message } from '../contract/index.ts';
export type CompletionParams = Parameters<CompletionSdk['completion']>[0];
interface CompletionParamsInput extends Omit<CompletionParams, 'stream' | 'history'> {
    history: Message[];
}
export declare function completionParams({ modelId, history, tools, generationParams, responseFormat, toolDialect, kvCache }: CompletionParamsInput): CompletionParams;
export {};
