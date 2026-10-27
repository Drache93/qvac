import type { SkillActivation, Toolset, ToolsetScoped } from '../contract/index.ts';
export interface ToolGrantSource<T extends {
    bin: string;
}> {
    name: string;
    tools: ReadonlyArray<string>;
    cliValidator?: T;
}
export interface ToolGrants<T extends {
    bin: string;
}> {
    grantedNames: Set<string>;
    grantedOwners: Map<string, Set<string>>;
    grantedOps: Map<string, T[]>;
}
export declare function collectToolGrants<T extends {
    bin: string;
}>(skills: ReadonlyArray<ToolGrantSource<T>>): ToolGrants<T>;
export declare function skillsAreSelected(scope: 'all' | 'selected' | null | undefined, hasAgent: boolean): boolean;
export declare function skillIsActive(name: string, { skillsSelected, enabledSkills }: Pick<SkillActivation, 'skillsSelected' | 'enabledSkills'>): boolean;
export interface SelectableTool {
    name: string;
    skillGated?: boolean | undefined;
    ungatedFor?: ReadonlyArray<string> | undefined;
    rootsRequired?: boolean | undefined;
    writeRootsRequired?: boolean | undefined;
    owningSkill?: string | undefined;
}
export interface ToolGateInputs {
    toolsSelected: boolean;
    allowlist: ReadonlyArray<string>;
    grantedNames: ReadonlySet<string>;
    grantedOwners: ReadonlyMap<string, ReadonlySet<string>>;
    loadedGrantedNames: ReadonlySet<string>;
    hasRoots: boolean;
    hasWriteRoots: boolean;
    hasActiveSkills: boolean;
    capabilityProfile?: string | undefined;
}
export declare function isSelected(scope: 'all' | 'selected' | null | undefined, list?: ReadonlyArray<string> | null): boolean;
export declare function enabledTools<T extends SelectableTool>(tools: ReadonlyArray<T>, { toolsSelected, allowlist, grantedNames, grantedOwners, loadedGrantedNames, hasRoots, hasWriteRoots, hasActiveSkills, capabilityProfile }: ToolGateInputs): T[];
export declare const NETWORK_TOOLSETS: ReadonlyArray<Toolset>;
export declare function permittedTools<T extends ToolsetScoped>(tools: ReadonlyArray<T>, disabled?: ReadonlyArray<string> | null): T[];
