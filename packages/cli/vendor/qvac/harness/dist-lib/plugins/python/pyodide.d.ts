import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { pyodideLoadOptions } from './loader.ts';
import { type LoadPyodideFn, type PyodideLike, type PythonRunResult } from './run-session.ts';
export { pyodideLoadOptions };
export type { LoadPyodideFn, PyodideLike, PythonRunResult };
export interface RunPythonOptions {
    readonly timeoutMs?: number;
    readonly maxOutputChars?: number;
    readonly signal?: BareAbortSignal;
    readonly packages?: readonly string[];
    readonly inputs?: readonly {
        readonly path: string;
        readonly bytes: Uint8Array;
    }[];
    readonly outputs?: readonly string[];
    readonly workdir?: string;
    readonly loadPyodide?: LoadPyodideFn;
    readonly network?: boolean;
    readonly hosts?: readonly string[];
    readonly askConnect?: (host: string) => Promise<boolean>;
    readonly allowed?: readonly string[];
}
export declare function runPython(code: string, options?: RunPythonOptions): Promise<PythonRunResult>;
