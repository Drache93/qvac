import type { ExecError, ExecLanguage, LanguageRun } from '../../lib/contract/exec.ts';
import type { LoadPyodideFn } from './pyodide.ts';
export interface PythonLanguageOptions {
    readonly loadPyodide?: LoadPyodideFn | undefined;
    readonly network?: boolean | undefined;
}
export declare function resolveScriptRun(rawArgs: Record<string, unknown>, skillsDir: string | undefined): LanguageRun | ExecError;
export declare function createPythonLanguage({ loadPyodide, network }?: PythonLanguageOptions): ExecLanguage;
