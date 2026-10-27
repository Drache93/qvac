import type { SkillSetup, SkillSetupField } from './manifest.ts';
export interface SkillSettingEntry {
    readonly skill: string;
    readonly key: string;
    readonly value: string;
    readonly agentId?: string | null;
}
export type SkillSettingsFn = (skill: string, agentId?: string | null) => Promise<Readonly<Record<string, string>>> | Readonly<Record<string, string>>;
export interface SkillSettingsEntry {
    readonly setup?: SkillSetup | undefined;
}
export declare function requiredSettings(entry: SkillSettingsEntry): readonly string[];
export declare function isSettingField(field: SkillSetupField): boolean;
export declare function settingEnvName(skill: string, key: string): string;
export declare function settingsEnv(skill: string, settings: Readonly<Record<string, string>>): Record<string, string>;
export declare function settingsScopeKey(skill: string, agentId?: string | null): string;
