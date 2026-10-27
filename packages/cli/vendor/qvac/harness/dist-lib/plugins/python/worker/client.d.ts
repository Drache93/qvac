import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { PythonRunResult, RunSpec } from '../run-session.ts';
export declare function preloadPythonAddons(): Promise<void>;
export interface RunSpecOptions {
    readonly timeoutMs: number;
    readonly signal?: BareAbortSignal | undefined;
    readonly askConnect?: ((host: string) => Promise<boolean>) | undefined;
}
export declare function runPythonInWorker(spec: RunSpec, opts: RunSpecOptions): Promise<PythonRunResult>;
