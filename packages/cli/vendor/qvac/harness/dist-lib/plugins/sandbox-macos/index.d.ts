import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import type { ExecShell } from '../../lib/contract/exec.ts';
import type { CompiledPolicy, PolicyEnforcement } from '../../lib/contract/index.ts';
export interface ProfileCounts {
    readonly roots: number;
    readonly reads?: number;
    readonly parents?: number;
    readonly denied?: number;
    readonly ancestors?: number;
    readonly sockets?: number;
    readonly proxy?: number;
}
export interface SeatbeltOptions {
    readonly sandboxExec?: string;
    readonly writable?: readonly string[];
}
export declare class SeatbeltSandbox implements HarnessPlugin {
    readonly name = "sandbox-macos";
    readonly api = 1;
    readonly provides: string[];
    readonly wants: string[];
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
    readonly shell: ExecShell;
    private readonly _sandboxExec;
    private readonly _writable;
    private _denied;
    private _proxy;
    private _userTemp;
    constructor({ sandboxExec, writable }?: SeatbeltOptions);
    get enforces(): PolicyEnforcement;
    validate(): string | null;
    setup(ctx: PluginContext): Promise<PluginSetup>;
    private _service;
    private _session;
    private _admit;
    private _workspace;
    static profile(policy: CompiledPolicy, { roots, reads, parents, denied, ancestors, sockets, proxy }: ProfileCounts): string;
    private static _reads;
    private static _network;
    private static _confined;
    private static _refused;
    private _runtime;
    private static _proxied;
    private static _env;
    private static _readRoots;
    private static _developerDir;
    private static _ancestors;
    private _scratch;
    private static _darwinUserTemp;
    private _probe;
}
