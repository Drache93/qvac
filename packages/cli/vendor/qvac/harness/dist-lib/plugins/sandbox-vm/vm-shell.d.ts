import type { ExecShell, ExecutionContext, ExecutionPlan } from '../../lib/contract/exec.ts';
import type { PolicyEnforcement } from '../../lib/contract/index.ts';
export declare const WORKDIR_REFUSED: string;
export interface VmImage {
    readonly kernel: string;
    readonly initrd: string;
}
export interface VmSandboxOptions {
    readonly image: VmImage;
    readonly network: false;
    readonly disk: false;
    readonly mounts: Readonly<Record<string, never>>;
    readonly vfkit?: string;
    readonly cpus?: number;
    readonly memory?: string | number;
}
export interface VmRunResult {
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
export interface VmSandbox {
    ready(): Promise<void>;
    run(command: string, options: {
        readonly env?: Record<string, string>;
        readonly timeout: number;
    }): Promise<VmRunResult>;
    close(): Promise<void>;
}
export type CreateSandbox = (options: VmSandboxOptions) => Promise<VmSandbox> | VmSandbox;
export declare function barevisorSandbox(options: VmSandboxOptions): Promise<VmSandbox>;
export declare class GuestShell implements ExecShell {
    readonly name = "sandbox-vm";
    readonly enforces: PolicyEnforcement;
    private readonly _options;
    private readonly _create;
    private _sandbox;
    private _closing;
    private _queue;
    constructor(options: VmSandboxOptions, create: CreateSandbox);
    resolve(args: Record<string, unknown>, ctx?: ExecutionContext): ExecutionPlan;
    close(): Promise<void>;
    private _serial;
    private _run;
    private _boot;
    private _open;
    private _stop;
}
