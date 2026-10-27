import { emptyCompletionContext } from './completion/context.ts';
import { atContextBoundary, cutOffMessage, cutShort, runsUnasked } from './completion/rules.ts';
import { completionMachineDefinition, transitionName } from './definition.ts';
export declare class CompletionMachine {
    static VERSION: number;
    static PLAN_MODE_REFUSAL: string;
    static create: (context?: import("./index.ts").CompletionContext, now?: () => number) => import("xstate").StateMachine<import("./index.ts").CompletionContext, {
        type: 'START';
    } | {
        type: 'PAUSE';
    } | {
        type: 'RESUME';
        pausedMs?: number;
    } | {
        type: 'RECOVERY_REQUIRED';
        operation: import("../contract/run.ts").Operation;
    } | {
        type: 'FACTS';
        value: import("./completion/types.ts").EngineFacts;
    } | {
        type: 'FAIL';
        value: {
            error: string;
        } | Extract<import("../helpers/engine-error.ts").EngineError, {
            tag: 'failed';
        }>;
    } | {
        type: `xstate.error.actor.${string}`;
        error: import("../helpers/engine-error.ts").EngineError;
    } | {
        type: `xstate.done.actor.${string}`;
        output: import("./index.ts").CompletionActorOutput;
    } | {
        type: 'OUTPUT';
        event: import("./index.ts").EngineEvent;
    } | {
        type: 'INPUT';
        mode: 'steer' | 'follow-up';
        id?: string;
        text: string;
        context?: import("../contract/run.ts").TurnContext;
        content?: string;
    }, {
        [x: string]: import("xstate").ActorRefFromLogic<import("xstate").PromiseActorLogic<void, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").AnsweredPayload, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").BatchDonePayload, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").InspectingOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").PrepareInspectionOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").PreparingOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").RetrievingOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").RoundDonePayload, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").SearchingOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").ToolDonePayload, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<{
            approved: boolean;
        }, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").PrepareRunOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").ResolvingOutput, import("./index.ts").InvocationInput> | import("xstate").PromiseActorLogic<import("./completion/types.ts").RoundDonePayload & {
            response: string;
        }, import("./index.ts").InvocationInput>> | undefined;
    }, {
        src: "answering";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").AnsweredPayload, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "approving";
        logic: import("xstate").PromiseActorLogic<{
            approved: boolean;
        }, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "batching";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").BatchDonePayload, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "cleanup";
        logic: import("xstate").PromiseActorLogic<void, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "executing";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").ToolDonePayload, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "finishing";
        logic: import("xstate").PromiseActorLogic<void, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "generating";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").RoundDonePayload, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "inspectPrepare";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").PrepareInspectionOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "inspecting";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").InspectingOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "preparing";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").PreparingOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "rejecting";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").ToolDonePayload, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "resolving";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").ResolvingOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "resume";
        logic: import("xstate").PromiseActorLogic<void, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "retrieving";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").RetrievingOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "runPrepare";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").PrepareRunOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "searching";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").SearchingOutput, import("./index.ts").InvocationInput>;
        id: string | undefined;
    } | {
        src: "wrapping";
        logic: import("xstate").PromiseActorLogic<import("./completion/types.ts").RoundDonePayload & {
            response: string;
        }, import("./index.ts").InvocationInput>;
        id: string | undefined;
    }, {
        type: "ackInput";
        params: undefined;
    } | {
        type: "ackSteering";
        params: import("./completion/implementations.ts").RoundParams;
    } | {
        type: "addKnowledge";
        params: import("./completion/types.ts").RetrievingOutput;
    } | {
        type: "answerCompletion";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "approveCompletion";
        params: undefined;
    } | {
        type: "authorizePrepare";
        params: import("./completion/types.ts").PrepareInspectionOutput;
    } | {
        type: "continueGoal";
        params: undefined;
    } | {
        type: "continueStop";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "continueWithInput";
        params: undefined;
    } | {
        type: "endRunOnTool";
        params: import("./completion/types.ts").ToolDonePayload;
    } | {
        type: "failCompletion";
        params: import("./completion/actions/completion.ts").CompletionFailureMessage | {
            tag: 'failed';
            message: string;
            name: string;
            code?: string;
            stack?: string;
            cause?: import("../helpers/engine-error.ts").ErrorCause;
        };
    } | {
        type: "finishBatch";
        params: import("./completion/types.ts").BatchDonePayload;
    } | {
        type: "finishDirectTool";
        params: import("./completion/types.ts").ToolDonePayload;
    } | {
        type: "finishRound";
        params: import("./completion/types.ts").RoundDonePayload;
    } | {
        type: "finishTool";
        params: import("./completion/types.ts").ToolDonePayload;
    } | {
        type: "finishWrapRound";
        params: import("./completion/types.ts").RoundDonePayload;
    } | {
        type: "markTimeUp";
        params: undefined;
    } | {
        type: "queueDirectSearch";
        params: import("./completion/types.ts").PreparingOutput;
    } | {
        type: "queueInput";
        params: undefined;
    } | {
        type: "recordFacts";
        params: undefined;
    } | {
        type: "recordPause";
        params: undefined;
    } | {
        type: "recordRecovery";
        params: undefined;
    } | {
        type: "rejectCutOffTool";
        params: import("./completion/types.ts").ResolvedCallSnapshot;
    } | {
        type: "rejectDeniedApproval";
        params: import("./completion/types.ts").RejectDeniedApprovalParams;
    } | {
        type: "rejectPlanModeWrite";
        params: import("./completion/actions/tools.ts").RejectPlanModeWriteParams;
    } | {
        type: "rejectRepeatedTool";
        params: import("./completion/types.ts").RepeatOfFailedCallParams;
    } | {
        type: "rejectTool";
        params: import("./completion/actions/tools.ts").RejectToolParams;
    } | {
        type: "requestApproval";
        params: import("./completion/types.ts").ApprovalCall;
    } | {
        type: "requestPrepare";
        params: import("./completion/actions/prepare.ts").RequestPrepareParams;
    } | {
        type: "resetCutRound";
        params: import("./completion/types.ts").ToolsResolvedPayload & import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "resolveTools";
        params: import("./completion/types.ts").ToolsResolvedPayload;
    } | {
        type: "resumeRun";
        params: undefined;
    } | {
        type: "retryCappedSearch";
        params: undefined;
    } | {
        type: "retryCutRound";
        params: undefined;
    } | {
        type: "retryMalformedRound";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "retryMuteRound";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "retryNarratedRound";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "selectNextTool";
        params: import("./completion/types.ts").ResolvedCallSnapshot;
    } | {
        type: "settleGoal";
        params: undefined;
    } | {
        type: "settlePrepare";
        params: import("./completion/types.ts").PrepareResult;
    } | {
        type: "settlePrepareFailure";
        params: import("./completion/types.ts").PrepareInspectionOutput | import("./completion/types.ts").PrepareRunOutput;
    } | {
        type: "startDirectTool";
        params: import("./completion/types.ts").DirectToolOutput;
    } | {
        type: "startInitialRound";
        params: import("./completion/types.ts").PreparingPayload;
    } | {
        type: "startNextRound";
        params: undefined;
    } | {
        type: "startTool";
        params: import("./completion/types.ts").ToolExecutionSnapshot & {
            gate: import("./completion/types.ts").ApprovalGate;
        };
    } | {
        type: "wrapCompletion";
        params: import("../contract/run.ts").RunOutcome;
    } | {
        type: "wrapCutCompletion";
        params: undefined;
    } | {
        type: "wrapDeliveredCompletion";
        params: undefined;
    } | {
        type: "wrapExhaustedCompletion";
        params: undefined;
    } | {
        type: "wrapMuteCompletion";
        params: import("./completion/types.ts").AnsweredPayload;
    } | {
        type: "wrapSearchCappedCompletion";
        params: undefined;
    }, {
        type: "allResolvedToolsCapped";
        params: unknown;
    } | {
        type: "approved";
        params: unknown;
    } | {
        type: "batchRan";
        params: unknown;
    } | {
        type: "canMuteRetry";
        params: unknown;
    } | {
        type: "canRetryCut";
        params: unknown;
    } | {
        type: "canRetrySearchCap";
        params: unknown;
    } | {
        type: "deliveredBefore";
        params: unknown;
    } | {
        type: "directAutoRuns";
        params: unknown;
    } | {
        type: "directExecution";
        params: unknown;
    } | {
        type: "directNeedsApproval";
        params: unknown;
    } | {
        type: "directRejected";
        params: unknown;
    } | {
        type: "directSearchNeeded";
        params: unknown;
    } | {
        type: "errorInActiveOrResumingAndInterrupted";
        params: unknown;
    } | {
        type: "errorInActiveOrResumingAndRecoveryRequired";
        params: unknown;
    } | {
        type: "errorInFinishing";
        params: import("xstate").NonReducibleUnknown;
    } | {
        type: "errorInPausing";
        params: unknown;
    } | {
        type: "errorInRoutableState";
        params: unknown;
    } | {
        type: "failInFinishing";
        params: import("xstate").NonReducibleUnknown;
    } | {
        type: "failedOutcome";
        params: unknown;
    } | {
        type: "goalStalled";
        params: unknown;
    } | {
        type: "goalTokensLeft";
        params: unknown;
    } | {
        type: "goalUnmet";
        params: unknown;
    } | {
        type: "hasAnswer";
        params: unknown;
    } | {
        type: "hasInput";
        params: unknown;
    } | {
        type: "hasQueuedTool";
        params: unknown;
    } | {
        type: "hasRoundsLeft";
        params: unknown;
    } | {
        type: "headCutOff";
        params: unknown;
    } | {
        type: "interrupted";
        params: unknown;
    } | {
        type: "malformedToolCall";
        params: unknown;
    } | {
        type: "narratedIntent";
        params: unknown;
    } | {
        type: "needsApproval";
        params: import("./completion/types.ts").ToolExecutionSnapshot | null | undefined;
    } | {
        type: "needsRecovery";
        params: unknown;
    } | {
        type: "noDirectTool";
        params: unknown;
    } | {
        type: "planModeWrite";
        params: unknown;
    } | {
        type: "prepareFailed";
        params: unknown;
    } | {
        type: "prepareNeeded";
        params: unknown;
    } | {
        type: "readBatchQueued";
        params: unknown;
    } | {
        type: "repeatOfFailed";
        params: unknown;
    } | {
        type: "repeatsBlocked";
        params: unknown;
    } | {
        type: "roundCut";
        params: unknown;
    } | {
        type: "roundHasToolCalls";
        params: unknown;
    } | {
        type: "searchPending";
        params: unknown;
    } | {
        type: "stopContinues";
        params: unknown;
    } | {
        type: "timeUp";
        params: unknown;
    } | {
        type: "toolAnswered";
        params: unknown;
    } | {
        type: "toolAutoRuns";
        params: unknown;
    } | {
        type: "toolEndedRun";
        params: unknown;
    } | {
        type: "toolRejected";
        params: unknown;
    }, "deadline", "done" | "failed" | "paused" | "pausing" | "resuming" | {
        active: "answering" | "finishing" | "generating" | "idle" | "prepareChecking" | "prepareRunning" | "preparing" | "resolving" | "retrieving" | "round" | "searching" | "wrapping" | {
            tools: "approving" | "batching" | "executing" | "inspecting" | "rejecting" | "selecting";
        };
    }, string, import("./index.ts").CompletionContext, {
        status: 'success';
        response: string;
        metrics: import("./index.ts").CompletionContext['metrics'];
    } | {
        status: 'failure';
        error: string;
    }, import("./index.ts").EngineEvent, import("xstate").MetaObject, {
        id: "completion";
        states: {
            readonly active: {
                states: {
                    readonly history: {};
                    readonly idle: {};
                    readonly preparing: {};
                    readonly prepareChecking: {};
                    readonly prepareRunning: {};
                    readonly searching: {};
                    readonly round: {};
                    readonly generating: {};
                    readonly resolving: {};
                    readonly answering: {};
                    readonly retrieving: {};
                    readonly tools: {
                        states: {
                            readonly selecting: {};
                            readonly batching: {};
                            readonly inspecting: {};
                            readonly rejecting: {};
                            readonly approving: {};
                            readonly executing: {};
                        };
                    };
                    readonly wrapping: {};
                    readonly finishing: {};
                };
            };
            readonly pausing: {};
            readonly resuming: {};
            readonly paused: {};
            readonly done: {};
            readonly failed: {};
        };
    }, import("xstate").MetaObject>;
    static definition: typeof completionMachineDefinition;
    static emptyContext: typeof emptyCompletionContext;
    static transitionName: typeof transitionName;
    static runsUnasked: typeof runsUnasked;
    static cutOffMessage: typeof cutOffMessage;
    static cutShort: typeof cutShort;
    static atContextBoundary: typeof atContextBoundary;
    static MAX_ROUND_CALLS: number;
    static MAX_ROUND_REPEATS: number;
}
export type { MachineDefinitionNode } from './definition.ts';
export type { EmptyCompletionContextOptions } from './completion/context.ts';
export type { CompletionActorLogic, CompletionParent, InvocationInput, Stage } from './completion/ports.ts';
export type { CompletionContext, RunPolicy, CompletionActorOutput, CompletionActorOutputs, EngineEvent } from './completion/types.ts';
