import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import type { ExecShell } from '../../lib/contract/exec.ts';
import type { PolicyEnforcement } from '../../lib/contract/index.ts';
import { type SeccompArch } from './seccomp.ts';
export interface LinuxSandboxOptions {
    readonly bwrap?: string;
    readonly writable?: readonly string[];
}
export interface BwrapRun {
    readonly read: 'all' | readonly string[];
    readonly links?: Readonly<Record<string, string>>;
    readonly write: readonly string[];
    readonly pins: readonly string[];
    readonly folders: readonly string[];
    readonly files: readonly string[];
    readonly network: boolean;
    readonly cwd?: string;
}
export declare class LinuxSandbox implements HarnessPlugin {
    readonly name = "sandbox-linux";
    readonly api = 1;
    readonly provides: string[];
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
    private readonly _bwrap;
    private readonly _writable;
    private _denied;
    private readonly _stubs;
    constructor({ bwrap, writable }?: LinuxSandboxOptions);
    validate(): string | null;
    setup(ctx: PluginContext): Promise<PluginSetup>;
    static argv(run: BwrapRun, line: string): string[];
    static seccomp(arch: SeccompArch): Uint8Array;
    private _service;
    private _admit;
    private _workspace;
    private static _confined;
    private _runtime;
    private static _feed;
    private _prepare;
    private _denyRoots;
    private static _pins;
    private _reads;
    private static _firstMissing;
    private _hold;
    private _release;
    private static _made;
    private static _env;
    private _probe;
}
