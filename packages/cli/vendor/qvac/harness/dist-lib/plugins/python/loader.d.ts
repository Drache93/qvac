import process from 'process';
import type { LoadPyodideFn } from './run-session.ts';
type NodeShapedProcess = typeof process & {
    binding(name: string): Record<string, unknown>;
};
export declare function nodeShapedProcess(base: typeof process): NodeShapedProcess;
declare const silentStdio: {
    stdin: () => null;
    stdout: (_msg: string) => void;
    stderr: (_msg: string) => void;
};
export declare function pyodideLoadOptions(): PyodideLoadOptions;
type PyodideLoadOptions = typeof silentStdio & {
    packageCacheDir?: string;
};
export declare function loadPyodideAddons(): Promise<void>;
export declare function glueIsPatched(src: string): boolean;
export declare const defaultLoad: LoadPyodideFn;
export {};
