import type { InstallStep, SkillRequires, SkillSetup } from './manifest.ts';
export { credentialSlots, type CredentialSlotSource } from './credential-slots.ts';
export { readSetup as readSkillSetup } from './manifest-parse.ts';
export interface SkillFrontMatter {
    name?: string;
    displayName?: string;
    description?: string;
    aliases?: string[];
    preloadOnName?: boolean;
    tools?: string[];
    platform?: string[];
    credentials?: string[];
    allowList?: string[];
    mcpReads?: string[];
    requires?: SkillRequires;
    install?: InstallStep[];
    setup?: SkillSetup;
    env?: Readonly<Record<string, string>>;
    stub?: boolean;
    minCapabilityProfile?: string;
    emoji?: string;
}
export interface ParsedSkill {
    meta: SkillFrontMatter;
    body: string;
}
export declare function parseSkillFrontMatter(raw: string): ParsedSkill;
