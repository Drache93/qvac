import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import type { LspServerConfig, SpawnServer } from './server.ts';
export type { LspServerConfig, ServerProcess, SpawnOptions, SpawnServer } from './server.ts';
export interface LspOptions {
    readonly servers: readonly LspServerConfig[];
    readonly idleMs?: number;
    readonly requestTimeoutMs?: number;
    readonly deniedRoots?: readonly string[];
    readonly spawn?: SpawnServer;
    readonly read?: readonly string[];
}
export declare class LspPlugin implements HarnessPlugin {
    readonly name = "lsp";
    readonly api = 1;
    readonly addons: {
        'bare-subprocess': () => Promise<{
            constants: Record<string, number>;
            errors: typeof import("bare-subprocess").errors;
            Subprocess: typeof import("bare-subprocess").Subprocess;
            spawn(file: string, args?: string[] | null, opts?: import("bare-subprocess").SpawnOptions): import("bare-subprocess").Subprocess;
            spawn(file: string, opts?: import("bare-subprocess").SpawnOptions): import("bare-subprocess").Subprocess;
            spawnSync(file: string, args?: string[] | null, opts?: import("bare-subprocess").SpawnSyncOptions): import("bare-subprocess").SpawnSyncResult;
            spawnSync(file: string, opts?: import("bare-subprocess").SpawnSyncOptions): import("bare-subprocess").SpawnSyncResult;
            default: typeof import("bare-subprocess");
        }>;
    };
    readonly read: readonly string[] | undefined;
    private readonly _options;
    constructor(options: LspOptions);
    validate(): string | null;
    setup(ctx: PluginContext): PluginSetup;
}
