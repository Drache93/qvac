export declare const OBSIDIAN_SKILL_NAME = "obsidian";
export declare const OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY = "obsidian_vault_path";
export declare const OBSIDIAN_VAULT_MODE_NOTE: string;
export declare const OBSIDIAN_BIN_CANDIDATES: Readonly<Record<string, readonly string[]>>;
export declare const OBSIDIAN_CONFIG_CANDIDATES: Readonly<Record<string, readonly string[]>>;
export declare function expandObsidianPath(candidate: string, env?: Record<string, string | undefined>, home?: string): string;
export declare function firstExistingPath(candidates: readonly string[], expand: (candidate: string) => string, exists: (candidate: string) => boolean): string | null;
export interface ObsidianPathProbe {
    expand?: (candidate: string) => string;
    exists?: (candidate: string) => boolean;
    readText?: (candidate: string) => string;
}
export declare function obsidianInstallState(platform: string | undefined, probe?: ObsidianPathProbe): 'installed' | 'missing';
export declare function parseObsidianCliEnabled(text: string): boolean | null;
export declare function obsidianCliState(platform: string | undefined, probe?: ObsidianPathProbe): 'enabled' | 'disabled' | 'unknown';
export declare function isSandboxedWorkbenchInstall(env?: Record<string, string | undefined>): boolean;
export declare function isObsidianVaultPath(value: string | null, existsDir?: (candidate: string) => boolean): boolean;
