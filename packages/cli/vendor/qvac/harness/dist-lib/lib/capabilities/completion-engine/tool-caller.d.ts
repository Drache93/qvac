import type { CallTool, CompletionEvent } from '../../contract/index.ts';
import type { CompletionActorInput } from './session.ts';
export declare const MAX_SCRIPT_CALLS = 16;
interface ToolCallerInput {
    callId: string;
    denied: Set<string>;
    emit(event: CompletionEvent): void;
}
export declare function toolCaller({ input: deps, context }: Pick<CompletionActorInput, 'input' | 'context'>, { callId, denied, emit }: ToolCallerInput): CallTool;
export {};
