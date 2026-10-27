import type { AnsweredPayload, CompletionActionArgs, CompletionContext, PreparingPayload, RetrievingOutput, RoundDonePayload } from '../types.ts';
import type { RunOutcome } from '../../../contract/run.ts';
import type { EngineError } from '../../../helpers/engine-error.ts';
export declare function startInitialRound({ context, params }: CompletionActionArgs<PreparingPayload>): Partial<CompletionContext>;
export declare function startNextRound({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function retryMuteRound(args: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export declare function retryNarratedRound({ context, params }: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export declare function retryMalformedRound({ context, params }: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export declare function retryCappedSearch({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function retryCutRound({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function wrapCutCompletion({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function continueWithInput({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function addKnowledge({ context, params }: CompletionActionArgs<RetrievingOutput>): Partial<CompletionContext>;
export declare function goalTurn({ policy, goal, plan }: Readonly<CompletionContext>): string;
export declare function continueGoal({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function continueStop({ context, params }: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export declare function settleGoal({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function finishRound({ context, params }: CompletionActionArgs<RoundDonePayload>): Partial<CompletionContext>;
export declare function finishWrapRound({ context, params }: CompletionActionArgs<RoundDonePayload>): Partial<CompletionContext>;
export declare function wrapCompletion({ params }: CompletionActionArgs<RunOutcome>): Partial<CompletionContext>;
export declare function wrapMuteCompletion(args: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export declare function wrapSearchCappedCompletion({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function wrapDeliveredCompletion({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function wrapExhaustedCompletion({ context }: CompletionActionArgs): Partial<CompletionContext>;
export declare function answerCompletion({ context, params }: CompletionActionArgs<AnsweredPayload>): Partial<CompletionContext>;
export interface CompletionFailureMessage {
    error: string;
}
type FailedEngineError = Extract<EngineError, {
    tag: 'failed';
}>;
export declare function failCompletion({ params }: CompletionActionArgs<FailedEngineError | CompletionFailureMessage>): Partial<CompletionContext>;
export declare function applyPreparation(context: Readonly<CompletionContext>, payload?: PreparingPayload): Partial<CompletionContext>;
export {};
