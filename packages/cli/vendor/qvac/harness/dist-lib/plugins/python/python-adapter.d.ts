import type { ExecutionAdapter } from '../../lib/contract/exec.ts';
import { type ExecInput } from '../../lib/tools/attachments/staging.ts';
import { type ExecError } from '../../lib/tools/attachments/output-policy.ts';
import { type LoadPyodideFn } from './pyodide.ts';
export declare function pinned(spec: string): string;
export declare function pipMessage(targets: readonly string[] | null, { sandbox }?: {
    sandbox?: boolean | undefined;
}): string;
export declare function sandboxInstallError(command: string, declared: readonly string[] | undefined): string | null;
export interface PipFromSourceHintOptions {
    readonly packages?: readonly string[] | undefined;
    readonly sandbox?: boolean;
}
export declare function pipFromSourceHint(stderr: string, source: string, { packages, sandbox }?: PipFromSourceHintOptions): string | null;
export declare function stringLiteralProgramHint(source: string): string | null;
export declare function checkCollapsedCompound(source: string): string | null;
export declare function checkPythonSource(command: string): string | null;
export declare function syntaxErrorHint(stderr: string, source: string): string | null;
export declare function missingFileHint(stderr: string): string | null;
export declare function parsePackages(value: unknown): string[] | ExecError | undefined;
export declare function parseInputs(value: unknown): ExecInput[] | ExecError | undefined;
export declare function parseOutputs(value: unknown): string[] | ExecError | undefined;
export declare function parseWorkdir(value: unknown): string | ExecError | undefined;
export interface OfficeImportContext {
    readonly packages: readonly string[] | undefined;
    readonly toolNames: readonly string[] | undefined;
}
export declare function officeModuleHint(stderr: string, toolNames: readonly string[] | undefined): string | null;
export declare function officeImportError(source: string, { packages, toolNames }: OfficeImportContext): string | null;
export interface MissingModuleHintOptions {
    readonly packages?: readonly string[] | undefined;
    readonly sandbox?: boolean;
    readonly network?: boolean;
}
export declare function missingModuleHint(stderr: string, { packages, sandbox, network }?: MissingModuleHintOptions): string | null;
export declare function shellNameHint(stderr: string): string | null;
export declare function noProcessHint(stderr: string, sandbox?: boolean): string | null;
export declare function noNetworkHint(stderr: string, tools?: readonly string[], network?: boolean): string | null;
export declare function nativeWheelHint(stderr: string): string | null;
export declare function packageFetchFailedHint(stderr: string): string | null;
export declare function createPythonAdapter(loadPyodide?: LoadPyodideFn, network?: boolean): ExecutionAdapter;
