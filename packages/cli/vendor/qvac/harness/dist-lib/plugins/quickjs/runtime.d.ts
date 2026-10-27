import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type ExecResult } from '../../lib/tools/exec/runner.ts';
export declare const MAX_DEADLINE_MS = 30000;
export declare const SLICE_MS = 10000;
export interface EvaluateOptions {
    readonly timeoutMs?: number | undefined;
    readonly maxOutputChars?: number | undefined;
    readonly signal?: BareAbortSignal | undefined;
}
export interface RuntimeLimits {
    readonly memoryLimit: number;
    readonly stackSize: number;
}
export type HostFunction = (arg: unknown) => Promise<unknown>;
export interface ScriptOptions {
    readonly bindings?: Record<string, Record<string, HostFunction>>;
    readonly sliceMs?: number;
    readonly totalMs?: number;
}
export type ScriptResult = {
    readonly value: unknown;
    readonly logs: string[];
} | {
    readonly error: string;
    readonly logs: string[];
};
export declare class Interpreter {
    private readonly _limits;
    private _module;
    private readonly _live;
    private _closed;
    constructor(limits: RuntimeLimits);
    private _load;
    private _drop;
    evaluate(source: string, options?: EvaluateOptions): Promise<ExecResult>;
    run(source: string, options?: ScriptOptions): Promise<ScriptResult>;
    close(): void;
}
