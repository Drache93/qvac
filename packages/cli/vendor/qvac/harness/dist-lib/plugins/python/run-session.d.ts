import { type ExecResult } from '../../lib/tools/exec/runner.ts';
export interface PyodideLike {
    runPython(code: string, options?: {
        filename?: string;
    }): unknown;
    runPythonAsync(code: string): Promise<unknown>;
    ffi?: unknown;
    pyimport?(name: string): unknown;
    loadPackage(name: string): Promise<unknown>;
    setStdout(options: {
        batched: (output: string) => void;
    }): void;
    setStderr(options: {
        batched: (output: string) => void;
    }): void;
    setInterruptBuffer(buffer: Uint8Array): void;
    globals: {
        set(key: string, value: unknown): void;
        get(key: string): unknown;
    };
    FS: {
        mkdirTree(path: string): void;
        chdir(path: string): void;
        cwd(): string;
        writeFile(path: string, data: Uint8Array): void;
        readFile(path: string, opts: {
            encoding: 'binary';
        }): Uint8Array;
        analyzePath(path: string): {
            exists: boolean;
        };
        readdir(path: string): string[];
        stat(path: string): {
            mode: number;
            size: number;
        };
        lstat(path: string): {
            mode: number;
        };
        isDir(mode: number): boolean;
        isLink(mode: number): boolean;
        unlink(path: string): void;
        rmdir(path: string): void;
    };
}
export type LoadPyodideFn = () => Promise<PyodideLike>;
export type PythonRunResult = ExecResult & {
    files?: ReadonlyMap<string, Uint8Array>;
    missing?: readonly string[];
    rejected?: readonly {
        name: string;
        reason: string;
    }[];
    undeclared?: readonly string[];
};
export interface RunSpec {
    readonly code: string;
    readonly packages?: readonly string[] | undefined;
    readonly inputs?: readonly {
        readonly path: string;
        readonly bytes: Uint8Array;
    }[] | undefined;
    readonly outputs?: readonly string[] | undefined;
    readonly workdir?: string | undefined;
    readonly maxOutputChars: number;
    readonly installTimeoutMs: number;
    readonly network?: boolean | undefined;
    readonly hosts?: readonly string[] | undefined;
    readonly allowed?: readonly string[] | undefined;
}
export interface RunOutcome {
    readonly result: PythonRunResult;
    readonly evict: boolean;
}
export declare function isPyodideFatal(error: unknown): boolean;
export declare function repairDoubleEscapedSource(code: string, message: string): string | null;
export interface PerformRunOptions {
    readonly isCancelled?: () => boolean;
    readonly askConnect?: ((host: string) => Promise<boolean>) | undefined;
}
export declare function performRun(py: PyodideLike, spec: RunSpec, opts?: PerformRunOptions): Promise<RunOutcome>;
