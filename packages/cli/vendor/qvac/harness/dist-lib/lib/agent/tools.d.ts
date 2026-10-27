import type { AgentSkill, ToolDefinition } from '../contract/index.ts';
export interface ToolSelectionInputs {
    responseFormat: boolean;
    tools: readonly ToolDefinition[];
    toolsSelected: boolean;
    allowlist: ReadonlyArray<string>;
    activeSkills: readonly AgentSkill[];
    loadedSkills: ReadonlySet<string>;
    grantedNames: ReadonlySet<string>;
    grantedOwners: ReadonlyMap<string, ReadonlySet<string>>;
    hasRoots: boolean;
    hasWriteRoots: boolean;
    capabilityProfile?: string | undefined;
}
export declare function selectEnabledTools(inputs: ToolSelectionInputs): ToolDefinition[];
