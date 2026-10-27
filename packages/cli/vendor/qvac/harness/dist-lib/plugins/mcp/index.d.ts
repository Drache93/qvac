import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import { type CredentialStoreFn, type SkillCatalogEntry } from '../../lib/tools/skills/index.ts';
import { type McpServerConfig } from './server.ts';
export type { McpServerConfig } from './server.ts';
export interface McpOptions {
    readonly servers?: readonly McpServerConfig[] | undefined;
    readonly generic?: boolean | undefined;
    readonly skillCatalog?: readonly SkillCatalogEntry[] | undefined;
    readonly credentialStore?: CredentialStoreFn | undefined;
    readonly setupTimeoutMs?: number | undefined;
    readonly read?: readonly string[] | undefined;
}
export declare class McpPlugin implements HarnessPlugin {
    readonly name = "mcp";
    readonly api = 1;
    readonly read: readonly string[] | undefined;
    private readonly _options;
    constructor(options: McpOptions);
    validate(): string | null;
    setup({ fetch }: PluginContext): Promise<PluginSetup>;
}
