import type { ToolDefinition, ToolFetch, ToolParameters } from '../../lib/contract/index.ts';
import { type CredentialStoreFn } from '../../lib/tools/skills/index.ts';
export interface McpServerConfig {
    readonly name: string;
    readonly url: string;
    readonly auth?: {
        readonly tokenCredentialKey: string;
    };
    readonly defer?: boolean;
}
export interface ListedTool {
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolParameters;
}
interface Discovery {
    readonly fetch: ToolFetch;
    readonly credentialStore: CredentialStoreFn | undefined;
    readonly timeoutMs: number;
}
export declare function listServerTools(server: McpServerConfig, { fetch, credentialStore, timeoutMs }: Discovery): Promise<ListedTool[]>;
export declare function serverTool(server: McpServerConfig, listed: ListedTool, credentialStore: CredentialStoreFn | undefined): ToolDefinition;
export {};
