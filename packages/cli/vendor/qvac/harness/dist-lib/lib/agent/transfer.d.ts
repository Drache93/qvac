import type { AgentHandoff, ToolDefinition } from '../contract/index.ts';
export declare const TRANSFER_TOOL_NAME = "transfer_to_agent";
export interface TransferResult {
    readonly transferred: string;
    readonly reason: string;
}
export declare function createTransferTool(handoffs: readonly AgentHandoff[]): ToolDefinition;
