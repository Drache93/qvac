import type { Tool as SdkTool } from '@qvac/inference';
export interface ToolOwnership {
    readonly name: string;
    readonly skillGated?: boolean | undefined;
    readonly owningSkill?: string | undefined;
}
export interface ToolPromptLogOptions {
    readonly promptPrefix: string;
    readonly modelId: string;
    readonly cacheKey: string | undefined;
    readonly agentId: string | undefined;
    readonly messageCount: number;
    readonly responseFormat: string | undefined;
    readonly tools: ReadonlyArray<SdkTool> | undefined;
    readonly definitions: ReadonlyArray<ToolOwnership>;
    readonly activeSkills: ReadonlyArray<string>;
    readonly skillsSelected: boolean;
    readonly enabledSkills: ReadonlyArray<string>;
    readonly mentionedSkill: string | null;
    readonly loadedSkills: ReadonlySet<string>;
    readonly toolOps: ReadonlyMap<string, ReadonlyArray<unknown>>;
}
export declare function logToolPrompt({ promptPrefix, modelId, cacheKey, agentId, messageCount, responseFormat, tools, definitions, activeSkills, skillsSelected, enabledSkills, mentionedSkill, loadedSkills, toolOps }: ToolPromptLogOptions): void;
