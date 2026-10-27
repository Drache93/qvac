import type { BatchDonePayload, CompletionActionArgs, CompletionContext, DirectToolOutput, GatedToolExecutionSnapshot, RejectDeniedApprovalParams, PreparingOutput, RepeatOfFailedCallParams, ResolvedCallSnapshot, ToolDonePayload, ToolExecutionSnapshot, ToolRejection, ToolsResolvedPayload } from '../types.ts';
export declare function resolveTools({ context, params }: CompletionActionArgs<ToolsResolvedPayload>): Partial<CompletionContext>;
export declare function selectNextTool({ params }: CompletionActionArgs<ResolvedCallSnapshot>): Partial<CompletionContext>;
export interface RejectToolParams {
    call: ResolvedCallSnapshot;
    execution: ToolExecutionSnapshot | null;
    rejection: ToolRejection;
}
export declare function rejectTool({ context, params }: CompletionActionArgs<RejectToolParams>): Partial<CompletionContext>;
export declare function rejectDeniedApproval({ context, params }: CompletionActionArgs<RejectDeniedApprovalParams>): Partial<CompletionContext>;
export declare function queueDirectSearch({ context, params }: CompletionActionArgs<PreparingOutput>): Partial<CompletionContext>;
export declare function startDirectTool({ params }: CompletionActionArgs<DirectToolOutput>): Partial<CompletionContext>;
export declare function startTool({ params }: CompletionActionArgs<GatedToolExecutionSnapshot>): Partial<CompletionContext>;
export declare function finishTool({ context, params }: CompletionActionArgs<ToolDonePayload>): Partial<CompletionContext>;
export declare function finishBatch({ context, params }: CompletionActionArgs<BatchDonePayload>): Partial<CompletionContext>;
export declare function endRunOnTool(args: CompletionActionArgs<ToolDonePayload>): Partial<CompletionContext>;
export declare function finishDirectTool({ context, params }: CompletionActionArgs<ToolDonePayload>): Partial<CompletionContext>;
export declare function rejectRepeatedTool({ params }: CompletionActionArgs<RepeatOfFailedCallParams>): Partial<CompletionContext>;
export declare function rejectCutOffTool({ context, params }: CompletionActionArgs<ResolvedCallSnapshot>): Partial<CompletionContext>;
export declare const PLAN_MODE_REFUSAL: string;
export interface RejectPlanModeWriteParams {
    call: ResolvedCallSnapshot;
    execution: GatedToolExecutionSnapshot;
}
export declare function rejectPlanModeWrite({ params }: CompletionActionArgs<RejectPlanModeWriteParams>): Partial<CompletionContext>;
