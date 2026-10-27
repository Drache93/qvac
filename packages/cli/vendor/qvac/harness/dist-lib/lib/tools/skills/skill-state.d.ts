import { type CredentialStoreFn } from './auth-resolver.ts';
import type { SkillRequires, SkillSetup } from './manifest.ts';
import { type SkillSettingsFn } from './skill-settings.ts';
import type { SkillReadiness } from '../../contract/index.ts';
import { type CapabilityProfile } from '../../models/model-catalog.ts';
import { SKILL_STATE, isAvailableState, type SkillState } from './skill-state-constants.ts';
export { SKILL_STATE, isAvailableState, type SkillState };
export interface SkillStateEntry {
    readonly name: string;
    readonly credentials: readonly string[];
    readonly platform: readonly string[];
    readonly requires?: SkillRequires;
    readonly stub?: boolean;
    readonly minCapabilityProfile?: string;
    readonly setup?: SkillSetup;
}
export interface SkillStateInputs {
    readonly credentialStore?: CredentialStoreFn | undefined;
    readonly settingsStore?: SkillSettingsFn | undefined;
    readonly platform?: string | undefined;
    readonly rejected?: ReadonlySet<string>;
    readonly agentId?: string | null | undefined;
    readonly binVersions?: ReadonlyMap<string, 'ok' | 'too-old' | 'unknown'> | undefined;
    readonly activeProfile?: CapabilityProfile | undefined;
    readonly readiness?: SkillReadiness | undefined;
    readonly binOnPath?: (bin: string, platform?: string) => boolean;
}
export declare function isStub(entry: Pick<SkillStateEntry, 'stub'>): boolean;
export interface SkillToolsEntry {
    readonly tools: readonly string[];
}
export declare function isToolSupported(entry: SkillToolsEntry, installedTools: ReadonlySet<string>): boolean;
export declare function supportsPlatform(entry: Pick<SkillStateEntry, 'platform'>, platform: string | undefined): boolean;
export declare function isModelCompatible(entry: Pick<SkillStateEntry, 'minCapabilityProfile'>, activeProfile: CapabilityProfile | undefined): boolean;
export declare function resolveSkillState(entry: SkillStateEntry, inputs?: SkillStateInputs): Promise<SkillState>;
