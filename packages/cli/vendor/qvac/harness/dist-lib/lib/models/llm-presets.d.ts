export interface LlmGenerationParams {
    temp?: number;
    top_p?: number;
    top_k?: number;
    presence_penalty?: number;
    repeat_penalty?: number;
    frequency_penalty?: number;
    seed?: number;
    reasoning_budget?: number;
    reasoning_rounds?: 'every' | 'plan';
    tool_choice?: 'auto' | 'none' | 'required';
    predict?: number;
    parallel_tool_calls?: boolean;
}
export declare const DEFAULT_REASONING_BUDGET = 8192;
export declare function resolveLlmGenerationParams(modelName: string | undefined, reasoningEnabled: boolean | undefined, deviceDefault?: boolean): LlmGenerationParams | undefined;
