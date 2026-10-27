import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { SpillSink, ToolSpill } from '../../contract/index.ts';
import type { ExecResult, KillProcess, SpawnFn } from '../../contract/exec.ts';
export type { Child, ExecAttachment, ExecResult, KillProcess, RejectedOutput, SpawnFn, SpawnOptions } from '../../contract/exec.ts';
export interface RunCommandOptions {
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
    readonly maxOutputChars?: number;
    readonly signal?: BareAbortSignal;
    readonly spill?: ToolSpill;
    readonly spawn: SpawnFn;
    readonly killProcess?: KillProcess;
    readonly platform?: string;
}
export declare const DEFAULT_TIMEOUT_MS = 120000;
export declare const MAX_OUTPUT_CHARS = 8192;
export declare const MAX_OUTPUT_CHARS_LIMIT = 65536;
interface CapturedOutput {
    readonly limit: number;
    readonly sink?: SpillSink;
    head: string;
    tail: string;
    total: number;
}
export declare function capOutput(text: string, limit: number): string;
export declare function appendOutput(output: CapturedOutput, chunk: Buffer | string): void;
export declare function formatOutput(output: CapturedOutput, locator?: string | null): string;
export declare function createCapturedOutput(limit: number, sink?: SpillSink): CapturedOutput;
export interface StartCommandOptions {
    readonly cwd?: string;
    readonly spawn: SpawnFn;
    readonly killProcess?: KillProcess;
    readonly platform?: string;
}
export interface StartedCommand {
    readonly exited: Promise<number>;
    stop(): Promise<void>;
}
export declare function startCommand(command: string, options: StartCommandOptions): StartedCommand;
export declare function runCommand(command: string, options: RunCommandOptions): Promise<ExecResult>;
