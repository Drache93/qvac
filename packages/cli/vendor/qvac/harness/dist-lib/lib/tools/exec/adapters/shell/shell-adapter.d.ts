import type { ExecShell, KillProcess, ShellRuntime, SpawnFn } from '../../../../contract/exec.ts';
export type { ShellRuntime } from '../../../../contract/exec.ts';
export interface ShellAdapterOptions {
    readonly name?: string;
    readonly spawn?: SpawnFn;
    readonly killProcess?: KillProcess;
    readonly loadRuntime: () => Promise<ShellRuntime>;
    readonly downloadNote: string;
}
export declare function createShellAdapter(options: ShellAdapterOptions): ExecShell;
