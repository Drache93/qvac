import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import type { ExecShell } from '../../lib/contract/exec.ts';
import type { PolicyEnforcement } from '../../lib/contract/index.ts';
export interface AppContainerOptions {
    readonly helper?: string;
}
export interface HelperRun {
    readonly write: readonly string[];
    readonly read: readonly string[];
    readonly deny: readonly string[];
    readonly network: boolean;
    readonly cwd?: string;
}
export declare class AppContainerSandbox implements HarnessPlugin {
    readonly name = "sandbox-windows";
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
    readonly enforces: PolicyEnforcement;
    readonly shell: ExecShell;
    private readonly _helper;
    private _denied;
    private readonly _prepared;
    private _preparing;
    constructor({ helper }?: AppContainerOptions);
    validate(): string | null;
    setup(ctx: PluginContext): Promise<PluginSetup>;
    static argv(run: HelperRun, line: string): string[];
    static steps({ write, read, deny }: HelperRun): string[][];
    static capability(kind: 'w' | 'r', root: string): string;
    private _admit;
    private _spawn;
    private _spawnHelper;
    private _prepare;
    private _enqueue;
    private static _prepareWith;
    private static _within;
    private static _confined;
    private static _env;
    private static _shipped;
    static prebuilt(arch: string): string;
    private _probe;
}
