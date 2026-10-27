import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type ExecResult, type KillProcess, type SpawnFn } from '../../lib/tools/exec/runner.ts';
export interface RunObsidianCliOptions {
    readonly timeoutMs?: number;
    readonly maxOutputChars?: number;
    readonly signal?: BareAbortSignal;
}
export interface RunOutcome {
    readonly result: string;
    readonly stderr: string;
    readonly exitCode: number | null;
}
export interface ObsidianCliRuntime {
    readonly spawn: SpawnFn;
    readonly killProcess?: KillProcess;
}
export declare function toResult(outcome: RunOutcome): ExecResult;
export declare function runObsidianCli(command: string, runtime: ObsidianCliRuntime, options?: RunObsidianCliOptions): Promise<ExecResult>;
