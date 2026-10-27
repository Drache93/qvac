import type { ToolDefinition } from '../contract/index.ts';
import { deniedRootsFor } from './fs/scope.ts';
import { compileOperationTools } from './operations/compile.ts';
import { stageInputs } from './attachments/staging.ts';
import type { CredentialStoreFn } from './skills/auth-resolver.ts';
import { ensureBundledSkillsDir } from './skills/bundled-dir.ts';
import type { SkillCatalogEntry } from './skills/catalog.ts';
export type { ExecInput } from './attachments/staging.ts';
export interface ProductToolsOptions {
    readonly sdkHome: string;
    readonly skillsDir?: string | undefined;
    readonly skillCatalog?: readonly SkillCatalogEntry[] | undefined;
    readonly credentialStore?: CredentialStoreFn | undefined;
    readonly files?: boolean | undefined;
}
export declare class Tools {
    static deniedRoots: typeof deniedRootsFor;
    static bundledSkillsDir: typeof ensureBundledSkillsDir;
    static stageInputs: typeof stageInputs;
    static operations: typeof compileOperationTools;
    static product({ sdkHome, skillsDir, skillCatalog, credentialStore, files }: ProductToolsOptions): ToolDefinition[];
}
