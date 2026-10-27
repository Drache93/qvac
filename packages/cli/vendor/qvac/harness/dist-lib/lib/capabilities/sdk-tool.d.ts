import type { Tool as SdkTool } from '@qvac/inference';
import type { AgentSkill, CompletionHistoryEntry, Message, ToolDefinition } from '../contract/index.ts';
export declare const TOOL_SEARCH_TOOL_NAME: string;
export declare function defers(tool: ToolDefinition): boolean;
export declare function deferredForRun(tool: ToolDefinition): ToolDefinition;
export declare function toSdkTool(tool: ToolDefinition): SdkTool;
export declare function toSdkTools(tools: readonly ToolDefinition[]): SdkTool[] | undefined;
export declare function renderedTools(tools: SdkTool[] | undefined): SdkTool[] | undefined;
export declare function loadedTools(history: readonly CompletionHistoryEntry[]): Set<string>;
export declare function loadTurns(sent: readonly SdkTool[] | undefined, names: Iterable<string>, history: readonly CompletionHistoryEntry[]): Message[];
interface SkillLoad {
    sent: readonly SdkTool[] | undefined;
    enabled: readonly ToolDefinition[];
    history: readonly CompletionHistoryEntry[];
}
export declare function skillLoadTurns(skill: Pick<AgentSkill, 'tools'> | undefined, { sent, enabled, history }: SkillLoad): Message[];
export declare function unloadedTools(tools: readonly ToolDefinition[], history: readonly CompletionHistoryEntry[]): Set<string>;
export declare function withToolSearch(tools: ToolDefinition[]): ToolDefinition[];
export {};
