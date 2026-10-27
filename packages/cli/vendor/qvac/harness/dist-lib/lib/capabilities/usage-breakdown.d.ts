import type { SystemPromptParts } from '../contract/index.ts';
export interface PromptDensity {
    prose: number;
    schema: number;
    toolBlockTokens: number;
}
export declare function densityFor(modelName?: string | null): PromptDensity;
export interface PromptUsageChars {
    systemPrompt: number;
    agentInstructions: number;
    activeSkills: number;
    toolSchemas: number;
}
export interface UsageBreakdown {
    systemPrompt: number;
    agentInstructions: number;
    activeSkills: number;
    tools: number;
    conversation: number;
    totalTokens: number;
}
export interface PromptUsagePartsInput {
    system: SystemPromptParts;
    toolSchemas?: ReadonlyArray<unknown> | undefined;
}
export declare function promptUsageParts({ system, toolSchemas }: PromptUsagePartsInput): PromptUsageChars;
export declare function usageBreakdown(chars: PromptUsageChars, totalTokens?: number | null, modelName?: string | null): UsageBreakdown | null;
