import type { CompletionSkillEntry } from '../capabilities/skill-entry.ts';
import type { SkillReadiness, ToolDefinition, ToolExecuteContext } from '../contract/index.ts';
import type { CredentialEntry, SkillsOptions, SkillWriteResult } from '../contract-types.ts';
import type { CredentialStoreFn, CredentialStoreValue } from '../tools/skills/auth-resolver.ts';
import { type ResolvedSkillCatalogEntry } from '../tools/skills/catalog.ts';
import { type CopyBaseResult, type DeleteOverlayResult, type ManagedSkill, type SkillFileContent } from '../tools/skills/overlay-crud.ts';
import { type SkillSettingEntry } from '../tools/skills/skill-settings.ts';
export interface HarnessSkillsOptions extends SkillsOptions {
    readonly skipBinProbe?: boolean;
}
export interface SkillsHostOptions {
    skillsDir?: string;
    platform?: string;
    credentialStore?: CredentialStoreFn;
    tools(): readonly ToolDefinition[];
    startPlugins(): Promise<void>;
}
export declare class SkillsHost {
    static readonly BIN_VERSION_PROBE_TTL_MS = 45000;
    private readonly _skillsDir?;
    private readonly _platform?;
    private readonly _credentialStore?;
    private readonly _tools;
    private readonly _startPlugins;
    private _watcher;
    private _allSkills;
    private _supportedSkills;
    private _credentials;
    private _settings;
    private _readiness;
    private _deviceSharedKeys;
    private _binVersionCache;
    private _binVersionInflight;
    constructor(opts: SkillsHostOptions);
    get names(): string[];
    open(): Promise<void>;
    close(): void;
    publish(skills: readonly SkillReadiness[]): void;
    setCredentials(entries: ReadonlyArray<CredentialEntry>): void;
    setSkillSettings(entries: ReadonlyArray<SkillSettingEntry>): void;
    skillSettings(skill: string, agentId?: string | null): Record<string, string>;
    skillEnv(skill: string): Readonly<Record<string, string>> | undefined;
    listManagedSkills(): Promise<ManagedSkill[]>;
    readSkillFile(name: string): Promise<SkillFileContent | null>;
    writeSkillFile(name: string, content: string): Promise<SkillWriteResult>;
    copyBaseForEdit(name: string): Promise<CopyBaseResult>;
    deleteOverlaySkill(name: string): Promise<DeleteOverlayResult>;
    resolveCredential(key: string, ctx?: ToolExecuteContext): Promise<CredentialStoreValue> | CredentialStoreValue;
    statuses(agentId?: string | null, modelName?: string | null, options?: HarnessSkillsOptions): Promise<ResolvedSkillCatalogEntry[]>;
    completionSkills(agentId: string | null, model: string): Promise<CompletionSkillEntry[]>;
    private _currentPlatform;
    private _installedTools;
    private _baseDir;
    private _overlayDir;
    private _reload;
    private _filter;
    private _watch;
    private _probeBinVersions;
    private _runBinVersionProbes;
}
