import type { CompletionActionArgs, CompletionContext, PrepareInspectionOutput, PrepareResult, PrepareRunOutput, PrepareStepProposal, PreparingPayload } from '../types.ts';
export interface RequestPrepareParams {
    preparation: PreparingPayload;
    step: PrepareStepProposal;
}
export declare function requestPrepare({ context, params }: CompletionActionArgs<RequestPrepareParams>): Partial<CompletionContext>;
export declare function authorizePrepare({ context, params }: CompletionActionArgs<PrepareInspectionOutput>): Partial<CompletionContext>;
export declare function settlePrepareFailure({ context, params }: CompletionActionArgs<PrepareInspectionOutput | PrepareRunOutput>): Partial<CompletionContext>;
export declare function settlePrepare({ context, params }: CompletionActionArgs<PrepareResult>): Partial<CompletionContext>;
