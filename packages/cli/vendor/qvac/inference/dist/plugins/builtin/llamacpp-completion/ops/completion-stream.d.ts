import type { AbortSignal } from 'bare-abort-controller';
import type { CompletionParams, CompletionStats, GenerationParams, ResponseFormat, Tool, ToolCall, ToolDialect } from '../../../../schemas/index.js';
import type { DisposableScope } from '../../../../runtime/disposable-scope.js';
import { type CacheMessage } from '../../../../utils/index.js';
import type { Logger } from '../../../../logging/types.js';
interface CompletionResult {
    modelExecutionMs: number;
    stats?: CompletionStats;
    toolCalls: ToolCall[];
    stoppedAtContextBoundary: boolean;
}
interface ChatHistory {
    role?: string;
    content?: string;
    type?: string;
    name?: string;
    description?: string;
    parameters?: unknown;
    tool_calls?: {
        id?: string;
        name: string;
        arguments: Record<string, unknown>;
    }[];
    tool_call_id?: string;
}
export type CompletionGenerationParams = GenerationParams & {
    json_schema?: string;
};
export declare function withParallelToolCalls(generationParams: CompletionGenerationParams | undefined): CompletionGenerationParams;
export declare function transformMessages(messages: Array<HistoryMsg | Tool>): ChatHistory[];
type HistoryMsg = CacheMessage;
/**
 * Put the model's configured system prompt in front of a history that carries
 * none. `transform.ts` strips `system_prompt` from the config handed to the
 * addon, so the conversation is the only way it reaches the model.
 */
export declare function seedConfiguredSystemPrompt<T extends {
    role: string;
    content: string;
}>(history: T[], modelConfig: unknown): T[];
export declare function completion(params: CompletionParams & {
    tools?: Tool[];
    generationParams?: GenerationParams;
    toolDialect?: ToolDialect;
    responseFormat?: ResponseFormat;
}, opts: {
    signal: AbortSignal;
    scope: DisposableScope;
    /**
     * Request-scoped logger forwarded to `createKvCacheSession` so
     * kv-cache lines share the request's lifecycle prefix. Falls
     * back to the module-level server logger when omitted.
     */
    logger?: Logger;
}): AsyncGenerator<{
    token: string;
}, CompletionResult, unknown>;
export {};
