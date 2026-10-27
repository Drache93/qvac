export type McpTokenProvider = 'github';
export interface McpProviderConfig {
    readonly provider: McpTokenProvider;
    readonly credentialKey: string;
    readonly label: string;
    readonly description: string;
    readonly tokenHelpUrl: string;
    readonly guide?: ReadonlyArray<string> | undefined;
}
export declare const MCP_TOKEN_PROVIDERS: ReadonlyArray<McpProviderConfig>;
export declare function isMcpTokenProvider(value: unknown): value is McpTokenProvider;
export declare function resolveMcpProvider(provider: McpTokenProvider): McpProviderConfig;
