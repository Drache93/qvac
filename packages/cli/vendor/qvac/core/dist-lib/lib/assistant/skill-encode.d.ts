import { type InstallStep, type SkillRequires, type SkillSetup } from '@qvac/harness';
import type { AssistantSkill } from '../../spec/hyperschema/types.d.ts';
export interface Skill {
    name: string;
    displayName?: string;
    description: string;
    status: string;
    tools: string[];
    credentials: string[];
    allowList: string[];
    platform: string[];
    requires?: SkillRequires;
    install?: InstallStep[];
    setup?: SkillSetup;
    stub?: boolean;
    minCapabilityProfile?: string;
    emoji?: string;
}
export declare function toEngineSkill(skill: Skill): AssistantSkill;
export declare function toEngineSkillRequirements(requires: SkillRequires): NonNullable<AssistantSkill['requirements']>;
export declare function toEngineInstallStep(step: InstallStep): NonNullable<AssistantSkill['install']>[number];
type EngineSetup = NonNullable<AssistantSkill['setup']>;
export declare function toEngineSkillSetup(setup: SkillSetup): EngineSetup;
export {};
