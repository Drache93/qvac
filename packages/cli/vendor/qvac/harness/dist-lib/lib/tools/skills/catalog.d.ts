import type { SkillReadiness } from '../../contract/index.ts';
import type { CredentialStoreFn } from './auth-resolver.ts';
import type { SkillSettingsFn } from './skill-settings.ts';
import type { InstallStep, SkillRequires, SkillSetup } from './manifest.ts';
import { type CliValidator } from './cli-schema.ts';
import { type SkillState } from './skill-state.ts';
import type { BinVersionState } from './bin-check.ts';
import { type CredentialCheckFetch } from './credential-check.ts';
import { type OperationSpec } from '../operations/manifest.ts';
import type { CapabilityProfile } from '../../models/model-catalog.ts';
export interface SkillCatalogEntry {
    name: string;
    displayName?: string;
    description: string;
    contentDigest?: string;
    aliases?: string[];
    preloadOnName?: boolean;
    tools: string[];
    credentials: string[];
    allowList: string[];
    mcpReads?: string[];
    platform: string[];
    requires?: SkillRequires;
    install?: InstallStep[];
    setup?: SkillSetup;
    env?: Readonly<Record<string, string>>;
    cliValidator?: CliValidator;
    stub?: boolean;
    minCapabilityProfile?: string;
    emoji?: string;
    referenceFiles?: string[];
    operations?: readonly OperationSpec[];
    origin?: 'overlay';
}
export interface ResolvedSkillCatalogEntry extends SkillCatalogEntry {
    status: SkillState;
}
export declare function skillSupportsPlatform(entry: SkillCatalogEntry, platform: string | undefined): boolean;
export interface VersionProbeOptions {
    installedTools: ReadonlySet<string>;
    platform: string | undefined;
    readiness?: ReadonlyMap<string, SkillReadiness>;
}
export declare function versionProbeSkills(catalog: readonly SkillCatalogEntry[], { installedTools, platform, readiness }: VersionProbeOptions): SkillCatalogEntry[];
export declare function availableSkills(catalog: readonly SkillCatalogEntry[], installedTools: ReadonlySet<string>, activeProfile?: CapabilityProfile): SkillCatalogEntry[];
export interface ResolveSkillStatusOptions {
    installedTools?: ReadonlySet<string>;
    credentialStore?: CredentialStoreFn;
    settingsStore?: SkillSettingsFn;
    platform?: string;
    agentId?: string | null;
    activeProfile?: CapabilityProfile;
    binVersions?: ReadonlyMap<string, ReadonlyMap<string, BinVersionState>>;
    refresh?: boolean;
    skipCredentialProbe?: boolean;
    fetchImpl?: CredentialCheckFetch;
    readiness?: ReadonlyMap<string, SkillReadiness>;
}
export interface CredentialProbeEligibilityOptions {
    platform?: string | undefined;
    installedTools?: ReadonlySet<string> | undefined;
}
export declare function skillsEligibleForCredentialProbe(catalog: readonly SkillCatalogEntry[], { platform, installedTools }?: CredentialProbeEligibilityOptions): SkillCatalogEntry[];
export declare function resolveSkillStatuses(catalog: readonly SkillCatalogEntry[], { installedTools, credentialStore, settingsStore, platform, agentId, activeProfile, binVersions, refresh, skipCredentialProbe, fetchImpl, readiness }?: ResolveSkillStatusOptions): Promise<ResolvedSkillCatalogEntry[]>;
export interface LoadSkillCatalogOptions {
    platform?: string | null;
    overlayDir?: string | null;
}
export declare function loadSkillCatalog(skillsDir: string, { platform, overlayDir }?: LoadSkillCatalogOptions): Promise<SkillCatalogEntry[]>;
export declare function mcpReadMethods(catalog: readonly SkillCatalogEntry[]): ReadonlyMap<string, ReadonlySet<string>>;
export declare function detectPlatform(): string;
