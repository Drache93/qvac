import type { ExecError } from '../../contract/exec.ts';
export declare const MAX_OUTPUT_FILE_BYTES: number;
export declare const MAX_OUTPUT_TOTAL_BYTES: number;
export declare const RUN_OUTPUT_BUDGET_BYTES: number;
export declare const MAX_OUTPUTS = 8;
export declare const MAX_INPUTS = 24;
export declare const MAX_INPUT_TOTAL_BYTES: number;
export declare function checkFileName(name: string): string | null;
export declare function checkOutputName(name: string): string | null;
export type { ExecError };
export interface AcceptedOutput {
    mimeType: string;
}
export declare function checkOutputBytes(name: string, bytes: Uint8Array, runningTotal: number): AcceptedOutput | ExecError;
