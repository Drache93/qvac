import type { InvocationInput } from './ports.ts';
import type { CompletionContext, DirectToolOutput, EngineEvent, PrepareResult, RejectDeniedApprovalParams, SearchingOutput } from './types.ts';
declare const createCompletionMachineImplementation: (context?: CompletionContext, now?: () => number) => import("xstate").StateMachine<CompletionContext, {
    type: 'START';
} | {
    type: 'PAUSE';
} | {
    type: 'RESUME';
    pausedMs?: number;
} | {
    type: 'RECOVERY_REQUIRED';
    operation: import("../../contract/run.ts").Operation;
} | {
    type: 'FACTS';
    value: import("./types.ts").EngineFacts;
} | {
    type: 'FAIL';
    value: {
        error: string;
    } | Extract<import("../../helpers/engine-error.ts").EngineError, {
        tag: 'failed';
    }>;
} | {
    type: `xstate.error.actor.${string}`;
    error: import("../../helpers/engine-error.ts").EngineError;
} | {
    type: `xstate.done.actor.${string}`;
    output: import("./types.ts").CompletionActorOutput;
} | {
    type: 'OUTPUT';
    event: EngineEvent;
} | {
    type: 'INPUT';
    mode: 'steer' | 'follow-up';
    id?: string;
    text: string;
    context?: import("../../contract/run.ts").TurnContext;
    content?: string;
}, {
    [x: string]: import("xstate").ActorRefFromLogic<import("xstate").PromiseActorLogic<void, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").AnsweredPayload, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").BatchDonePayload, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").InspectingOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").PrepareInspectionOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").PreparingOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").RetrievingOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").RoundDonePayload, InvocationInput> | import("xstate").PromiseActorLogic<SearchingOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").ToolDonePayload, InvocationInput> | import("xstate").PromiseActorLogic<{
        approved: boolean;
    }, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").PrepareRunOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").ResolvingOutput, InvocationInput> | import("xstate").PromiseActorLogic<import("./types.ts").RoundDonePayload & {
        response: string;
    }, InvocationInput>> | undefined;
}, {
    src: "answering";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").AnsweredPayload, InvocationInput>;
    id: string | undefined;
} | {
    src: "approving";
    logic: import("xstate").PromiseActorLogic<{
        approved: boolean;
    }, InvocationInput>;
    id: string | undefined;
} | {
    src: "batching";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").BatchDonePayload, InvocationInput>;
    id: string | undefined;
} | {
    src: "cleanup";
    logic: import("xstate").PromiseActorLogic<void, InvocationInput>;
    id: string | undefined;
} | {
    src: "executing";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").ToolDonePayload, InvocationInput>;
    id: string | undefined;
} | {
    src: "finishing";
    logic: import("xstate").PromiseActorLogic<void, InvocationInput>;
    id: string | undefined;
} | {
    src: "generating";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").RoundDonePayload, InvocationInput>;
    id: string | undefined;
} | {
    src: "inspectPrepare";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").PrepareInspectionOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "inspecting";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").InspectingOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "preparing";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").PreparingOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "rejecting";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").ToolDonePayload, InvocationInput>;
    id: string | undefined;
} | {
    src: "resolving";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").ResolvingOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "resume";
    logic: import("xstate").PromiseActorLogic<void, InvocationInput>;
    id: string | undefined;
} | {
    src: "retrieving";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").RetrievingOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "runPrepare";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").PrepareRunOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "searching";
    logic: import("xstate").PromiseActorLogic<SearchingOutput, InvocationInput>;
    id: string | undefined;
} | {
    src: "wrapping";
    logic: import("xstate").PromiseActorLogic<import("./types.ts").RoundDonePayload & {
        response: string;
    }, InvocationInput>;
    id: string | undefined;
}, {
    type: "ackInput";
    params: undefined;
} | {
    type: "ackSteering";
    params: import("./implementations.ts").RoundParams;
} | {
    type: "addKnowledge";
    params: import("./types.ts").RetrievingOutput;
} | {
    type: "answerCompletion";
    params: import("./types.ts").AnsweredPayload;
} | {
    type: "approveCompletion";
    params: undefined;
} | {
    type: "authorizePrepare";
    params: import("./types.ts").PrepareInspectionOutput;
} | {
    type: "continueGoal";
    params: undefined;
} | {
    type: "continueStop";
    params: import("./types.ts").AnsweredPayload;
} | {
    type: "continueWithInput";
    params: undefined;
} | {
    type: "endRunOnTool";
    params: import("./types.ts").ToolDonePayload;
} | {
    type: "failCompletion";
    params: import("./actions/completion.ts").CompletionFailureMessage | {
        tag: 'failed';
        message: string;
        name: string;
        code?: string;
        stack?: string;
        cause?: import("../../helpers/engine-error.ts").ErrorCause;
    };
} | {
    type: "finishBatch";
    params: import("./types.ts").BatchDonePayload;
} | {
    type: "finishDirectTool";
    params: import("./types.ts").ToolDonePayload;
} | {
    type: "finishRound";
    params: import("./types.ts").RoundDonePayload;
} | {
    type: "finishTool";
    params: import("./types.ts").ToolDonePayload;
} | {
    type: "finishWrapRound";
    params: import("./types.ts").RoundDonePayload;
} | {
    type: "markTimeUp";
    params: undefined;
} | {
    type: "queueDirectSearch";
    params: import("./types.ts").PreparingOutput;
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
    params: import("./types.ts").ResolvedCallSnapshot;
} | {
    type: "rejectDeniedApproval";
    params: RejectDeniedApprovalParams;
} | {
    type: "rejectPlanModeWrite";
    params: import("./actions/tools.ts").RejectPlanModeWriteParams;
} | {
    type: "rejectRepeatedTool";
    params: import("./types.ts").RepeatOfFailedCallParams;
} | {
    type: "rejectTool";
    params: import("./actions/tools.ts").RejectToolParams;
} | {
    type: "requestApproval";
    params: import("./types.ts").ApprovalCall;
} | {
    type: "requestPrepare";
    params: import("./actions/prepare.ts").RequestPrepareParams;
} | {
    type: "resetCutRound";
    params: import("./types.ts").ToolsResolvedPayload & import("./types.ts").AnsweredPayload;
} | {
    type: "resolveTools";
    params: import("./types.ts").ToolsResolvedPayload;
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
    params: import("./types.ts").AnsweredPayload;
} | {
    type: "retryMuteRound";
    params: import("./types.ts").AnsweredPayload;
} | {
    type: "retryNarratedRound";
    params: import("./types.ts").AnsweredPayload;
} | {
    type: "selectNextTool";
    params: import("./types.ts").ResolvedCallSnapshot;
} | {
    type: "settleGoal";
    params: undefined;
} | {
    type: "settlePrepare";
    params: PrepareResult;
} | {
    type: "settlePrepareFailure";
    params: import("./types.ts").PrepareInspectionOutput | import("./types.ts").PrepareRunOutput;
} | {
    type: "startDirectTool";
    params: DirectToolOutput;
} | {
    type: "startInitialRound";
    params: import("./types.ts").PreparingPayload;
} | {
    type: "startNextRound";
    params: undefined;
} | {
    type: "startTool";
    params: import("./types.ts").ToolExecutionSnapshot & {
        gate: import("./types.ts").ApprovalGate;
    };
} | {
    type: "wrapCompletion";
    params: import("../../contract/run.ts").RunOutcome;
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
    params: import("./types.ts").AnsweredPayload;
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
    params: import("./types.ts").ToolExecutionSnapshot | null | undefined;
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
}, string, CompletionContext, {
    status: 'success';
    response: string;
    metrics: CompletionContext['metrics'];
} | {
    status: 'failure';
    error: string;
}, EngineEvent, import("xstate").MetaObject, {
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
export declare const createCompletionMachine: typeof createCompletionMachineImplementation;
export {};
