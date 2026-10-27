import type { ToolDefinition, ToolExecuteContext } from '../../lib/contract/index.ts';
import { type CredentialAllowList, type CredentialAllowListFn, type CredentialStoreFn, type HttpRequestAuth } from '../../lib/tools/skills/index.ts';
export interface McpCallToolOptions {
    credentialStore?: CredentialStoreFn | undefined;
    credentialAllowList?: CredentialAllowListFn | undefined;
    readMethods?: ReadonlyMap<string, ReadonlySet<string>> | undefined;
}
export interface McpSend {
    readonly url: URL;
    readonly method: string;
    readonly params: Record<string, unknown> | undefined;
    readonly auth: HttpRequestAuth | undefined;
    readonly credentialStore: CredentialStoreFn | undefined;
    readonly credentialAllowList: CredentialAllowList | undefined;
}
export declare function sendMcp(request: McpSend, ctx: ToolExecuteContext | undefined): Promise<unknown>;
export declare function createMcpCallTool({ credentialStore, credentialAllowList, readMethods }?: McpCallToolOptions): ToolDefinition;
