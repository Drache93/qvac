import { z } from 'zod';
import { type Tool, type ToolCall, type ToolCallWithCall } from '@qvac/inference/surface';
type ZodObjectType = z.ZodObject<z.ZodRawShape>;
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
export type ToolInput<T extends ZodObjectType = ZodObjectType> = {
    name: string;
    description: string;
    parameters: T;
    handler?: ToolHandler;
    /** Keep this tool's parameter schema out of the initial prompt; see `Tool.deferLoading`. */
    deferLoading?: boolean;
    /** Heading this tool is listed under in the deferred catalog. */
    group?: string;
};
export declare function convertToolInput(input: ToolInput): Tool;
export declare function convertTools(inputs: ToolInput[]): Tool[];
/**
 * Validates and converts tools from either ToolInput (with Zod schemas) or full Tool format.
 * Returns validated Tool[] array.
 */
export type ToolHandlerMap = Map<string, ToolHandler>;
export type ValidateToolsResult = {
    tools: Tool[];
    handlers: ToolHandlerMap;
};
export declare function validateTools(tools: Tool[] | ToolInput[]): ValidateToolsResult;
export declare function attachHandlersToToolCalls(toolCalls: ToolCall[], handlers: ToolHandlerMap): ToolCallWithCall[];
export {};
//# sourceMappingURL=tool-helpers.d.ts.map