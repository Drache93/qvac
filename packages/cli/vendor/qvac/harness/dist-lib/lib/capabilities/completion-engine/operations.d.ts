import type { CompletionArgs } from './loop.ts';
import type { CompletionDeps } from './session.ts';
import { type ToolOperationFacts } from './durable.ts';
import type { CompletionContext } from '../../machine/index.ts';
export declare class ToolPolicyChanged extends Error {
    constructor(tool: string);
}
export declare function toolOperationFacts(value: unknown): ToolOperationFacts;
export declare function bindOperations(deps: CompletionDeps, context: CompletionContext, stage: string): CompletionArgs;
