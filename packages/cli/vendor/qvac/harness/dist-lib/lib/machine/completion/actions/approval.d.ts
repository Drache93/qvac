import type { ApprovalCall, CompletionActionArgs, CompletionContext } from '../types.ts';
export declare function requestApproval({ context, params: call }: CompletionActionArgs<ApprovalCall>): Partial<CompletionContext>;
export declare function approveCompletion({ context }: CompletionActionArgs): Partial<CompletionContext>;
