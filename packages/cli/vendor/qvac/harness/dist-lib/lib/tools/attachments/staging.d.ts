import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { AttachFn, FetchAttachmentFn, RunBudget } from '../../contract/index.ts';
import type { ExecAttachment, RejectedOutput } from '../exec/runner.ts';
import { type ExecError } from './output-policy.ts';
export interface ExecInput {
    readonly attachmentId?: string;
    readonly path: string;
}
export interface StagedInput {
    readonly path: string;
    readonly bytes: Uint8Array;
}
export interface StageInputsOptions {
    turnImages?: readonly {
        path: string;
    }[];
    signal?: BareAbortSignal;
}
export interface StagedInputs {
    files: readonly StagedInput[];
}
export declare function stageInputs(fetchAttachment: FetchAttachmentFn, inputs: readonly ExecInput[], opts?: StageInputsOptions): Promise<StagedInputs | ExecError>;
export interface AttachOutputsOptions {
    readonly declared: readonly string[];
    readonly runBudget?: RunBudget | undefined;
}
export interface AttachedOutputs {
    attachments: readonly ExecAttachment[];
    missingOutputs: readonly string[];
    rejectedOutputs: readonly RejectedOutput[];
}
export declare function attachOutputs(attach: AttachFn, files: ReadonlyMap<string, Uint8Array>, { declared, runBudget }: AttachOutputsOptions): Promise<AttachedOutputs>;
