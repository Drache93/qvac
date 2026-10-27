import type { CompletionHistoryEntry, GoalStatus, HistorySplice, HookRejection, Operation, PlanStep, ResourceDescriptor, RoundSpeed, RunBackendUse, RunBudget, RunOutcome, ToolActivityEvent, ToolCallDisplay, ToolEffect, ToolExecutionOutcome, ToolSpeed, TrustedSourceFacts, TurnContext } from '../../contract/run.ts';
import type { EngineError } from '../../helpers/engine-error.ts';
import type { FailureResultValue } from '../../helpers/failure-result.ts';
export interface CompletionStats {
    timeToFirstToken?: number | undefined;
    promptTokensPerSecond?: number | undefined;
    generatedTokens?: number | undefined;
    tokensPerSecond?: number | undefined;
    promptTokens?: number | undefined;
    cacheTokens?: number | undefined;
    contextBoundary?: boolean | undefined;
}
export interface EngineEvent {
    type: string;
    runId?: string;
    round?: number;
    callId?: string;
    id?: string;
    text?: string;
    reason?: string;
    replacedTypes?: ('content' | 'thinking')[];
    status?: GoalStatus;
    turn?: number;
    checks?: string[];
    context?: TurnContext;
}
export interface EngineFacts extends Record<string, unknown> {
    runBudget: RunBudget;
}
export interface CompletionMetrics {
    ttft?: number;
    tokens: number;
    timedTokens: number;
    decodeMs: number;
    promptTokens?: number;
    cacheTokens?: number;
    ctxSize?: number;
    backends?: RunBackendUse[];
    stopReason?: string;
    rounds: RoundSpeed[];
    tools: ToolSpeed[];
}
export interface ApprovalCall {
    callId?: string;
    round?: number;
    name: string;
    arguments: Record<string, unknown>;
    resource?: {
        kind: string;
        label: string;
    } | null;
    effect?: 'read' | 'write';
    intent?: string | null;
    display?: ToolCallDisplay | null;
    quote?: string | null;
}
export interface RoundToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    raw?: string;
}
export interface RoundToolError {
    code: string;
    message: string;
    raw?: string;
}
export interface RoundDonePayload {
    contentText: string;
    thinkingText?: string;
    promptPrefix?: string;
    toolCalls: RoundToolCall[];
    toolErrors?: RoundToolError[];
    stats?: CompletionStats;
    stopReason?: string;
    durationMs: number;
    ctxSize?: number | undefined;
    overflows?: number | undefined;
    reasoningDeltas?: number | undefined;
    replay: string | null;
    response?: string;
    history?: HistorySplice;
    cacheable?: boolean;
    fallbackResponse?: string;
    cut?: string;
}
export interface ResolvedCallSnapshot {
    key: string;
    id: string;
    name: string;
    args: Record<string, unknown>;
    rawCall?: string;
    intent?: string;
    rejection?: HookRejection;
    permission?: 'allow' | 'ask';
    concurrent?: true;
    leavesPlan?: true;
    cutOff?: true;
}
export interface ToolExecutionSnapshot {
    kind: 'direct' | 'tool';
    effect: ToolEffect;
    origin: ToolRejection['source'];
    webSearch: boolean;
    gate?: ApprovalGate | null;
}
export type GatedToolExecutionSnapshot = ToolExecutionSnapshot & {
    gate: ApprovalGate;
};
export interface RepeatOfFailedCallParams {
    call: ResolvedCallSnapshot;
    prior: SettledCall;
}
export interface ToolPreflightFacts {
    key: string;
    validationError: string | null;
    refusal: string | null;
    deniedKey: string | null;
    effect: ToolEffect;
    autoApprove: boolean;
    skipApprovals: boolean;
    resource: ResourceDescriptor | null;
    permission?: 'allow' | 'ask';
}
export interface ApprovalGate {
    facts: ToolPreflightFacts;
    approver: boolean;
    call: ApprovalCall;
}
export interface ToolDonePayload {
    deniedKey?: string;
    webSearch?: boolean;
    searchCapped?: boolean;
    history?: HistorySplice;
    source?: TrustedSourceFacts;
    failed?: {
        key: string;
        resultRef: string;
        outcome: ToolExecutionOutcome;
        value?: FailureResultValue;
    };
    progressed?: boolean;
    blockedRepeat?: boolean;
    unchanged?: boolean;
    settled?: {
        key: string;
        digest: string;
    };
    stableRead?: true;
    endedRun?: boolean;
    answer?: string;
    delivered?: boolean;
    durationMs?: number;
    activate?: string;
    plan?: PlanStep[];
    leftPlanMode?: boolean;
    checked?: GoalCheck[];
}
export interface BatchDonePayload {
    history?: HistorySplice;
    results: Omit<ToolDonePayload, 'history' | 'endedRun'>[];
}
export interface SettledCall {
    resultRef: string;
    outcome: ToolExecutionOutcome;
}
export type RejectedToolResult = {
    result: unknown;
    resultRef?: never;
} | {
    resultRef: string;
    result?: never;
};
export type ToolRejectedPayload = RejectedToolResult & {
    call: ResolvedCallSnapshot;
    activity: ToolActivityEvent | null;
    effect?: ToolEffect;
    outcome?: ToolExecutionOutcome;
    deniedKey?: string;
    emitCall: boolean;
    emitResult: boolean;
    capped: boolean;
    source: 'skill' | 'tool-result';
    repeat?: ToolExecutionOutcome;
};
export type ToolPolicyRejection = 'skill-already-loaded' | 'skill-unready' | 'skill-unavailable' | 'search-cap' | 'hook-rejected' | 'unknown-tool' | 'validation' | 'outbound-refusal' | 'already-denied' | 'denied-without-approver';
export type DirectToolRejectedPayload = ToolRejectedPayload & {
    execution: ToolExecutionSnapshot;
    preparation: PreparingPayload;
};
export interface ToolStartedPayload {
    call: ResolvedCallSnapshot;
    execution: ToolExecutionSnapshot;
    preparation: PreparingPayload;
}
export interface PreparingPayload {
    history?: HistorySplice;
    activated?: string[];
    webSearches?: number;
    deniedKeys?: string[];
    sources?: TrustedSourceFacts[];
    availableTools?: string[];
    promptPrefix?: string;
    checkable?: boolean;
}
export interface PrepareStepProposal {
    id: string;
    tool: string;
    args: Record<string, unknown>;
    available: boolean;
    effect: ToolEffect | null;
    done: boolean;
    history: HistorySplice;
    pendingSearch: string | null;
}
export interface PrepareStep {
    id: string;
    tool: string;
    args: Record<string, unknown>;
    facts?: ToolPreflightFacts;
}
export interface PrepareFailure {
    error: string;
    history?: HistorySplice;
}
export interface PrepareResult {
    history?: HistorySplice;
    source?: TrustedSourceFacts;
    cacheable?: boolean;
    activate?: string;
}
export interface AnsweredPayload {
    history?: HistorySplice;
    response?: string;
    continue?: string;
    stats?: CompletionStats;
    stopReason?: string;
    durationMs?: number;
    narrated?: string;
    malformed?: boolean;
    cutOff?: true;
}
export interface ToolsResolvedPayload {
    calls: ResolvedCallSnapshot[];
    history?: HistorySplice;
}
export interface RunPolicy {
    maxToolRounds: number;
    continuationNudge: string;
    deliveredNudge: string;
    deniedMessage: string;
    cutOffMessage: string;
    contextBoundaryMessage: string;
    roundCutMessage: string;
    repeatedCallMessage: string;
    unchangedMessage: string;
    failingMessage?: string;
    goalNudge: string;
}
export interface SettledResult {
    digest: string;
    repeats: number;
    round: number;
    folded?: true;
}
export interface GoalCheck {
    name: string;
    passed: boolean;
    output: string | null;
}
export interface GoalState {
    objective: string;
    tokens: number | null;
    turns: number;
    status: GoalStatus;
    checks: GoalCheck[];
    checkable?: boolean;
    named?: boolean;
}
export interface QueuedInput {
    id?: string;
    text: string;
    context?: TurnContext;
    content?: string;
}
export interface CompletionContext {
    runId: string;
    policy: RunPolicy;
    timeUp: boolean;
    pauseCount: number;
    durable: EngineFacts | null;
    recovery: Operation | undefined;
    history: CompletionHistoryEntry[];
    failureResults: Record<string, FailureResultValue>;
    response: string;
    sources: TrustedSourceFacts[];
    availableTools: string[];
    promptPrefix: string;
    round: number;
    roundsSent: number;
    mute: number;
    cuts: number;
    narrated: boolean;
    malformed: boolean;
    webSearches: number;
    directSearchDone: boolean;
    pendingSearch: string | null;
    cappedRounds: number;
    deniedKeys: string[];
    failedCalls: Record<string, SettledCall>;
    blockedRepeats: number;
    settledResults: Record<string, SettledResult>;
    failureStreaks?: Record<string, number>;
    answeredReads?: string[];
    roundProgressed: boolean;
    answer: string | null;
    delivered: boolean;
    deliveredThisRound: boolean;
    activated: string[];
    outcome: RunOutcome | 'failed' | null;
    metrics: CompletionMetrics;
    agentId: string | null;
    cacheKey: string | null;
    lastRound: RoundDonePayload | null;
    prepareStep: PrepareStep | null;
    pendingCall: ApprovalCall | null;
    approval: {
        status: 'idle' | 'pending' | 'approved' | 'denied';
        key: string | null;
    };
    currentCall: ResolvedCallSnapshot | null;
    execution: ToolExecutionSnapshot | null;
    rejectedCall: ToolRejectedPayload | null;
    toolQueue: ResolvedCallSnapshot[];
    cappedCalls: number;
    resolvedCount: number;
    failure: Extract<EngineError, {
        tag: 'failed';
    }> | null;
    failMessage: string | null;
    steering: QueuedInput[];
    followUps: QueuedInput[];
    edgeInputs: QueuedInput[];
    plan: PlanStep[];
    planMode: boolean;
    goal: GoalState | null;
}
export interface CompletionActionArgs<Params = undefined> {
    readonly context: Readonly<CompletionContext>;
    readonly params: Params;
}
export interface PreparingOutput {
    preparation: PreparingPayload;
    step: PrepareStepProposal | null;
    searchQuery: string | null;
}
export interface RetrievingOutput {
    history?: HistorySplice;
    sources?: TrustedSourceFacts[];
}
export interface DirectToolOutput {
    call: ResolvedCallSnapshot;
    execution: ToolExecutionSnapshot;
    hookRejection: HookRejection | null;
    resource: ResourceDescriptor | null;
    rejection?: ToolRejection;
}
export interface ToolRejection {
    result: unknown;
    outcome?: ToolExecutionOutcome;
    activity: ToolActivityEvent | null;
    effect?: ToolEffect;
    source: 'skill' | 'tool-result';
    deniedKey?: string;
    emitCall?: boolean;
    emitResult?: boolean;
    capped?: boolean;
    repeat?: ToolExecutionOutcome;
}
export interface SearchingOutput {
    directTool: DirectToolOutput | null;
}
export interface RejectDeniedApprovalParams {
    call: ResolvedCallSnapshot;
    execution: GatedToolExecutionSnapshot;
}
export interface PrepareInspectionOutput {
    tool: string;
    args: Record<string, unknown>;
    facts: ToolPreflightFacts | null;
    hookRejection: HookRejection | null;
    failure: PrepareFailure | null;
}
export type PrepareRunOutput = PrepareResult | {
    failure: PrepareFailure;
};
export type ResolvingOutput = ToolsResolvedPayload & AnsweredPayload;
export interface InspectingOutput {
    call: ResolvedCallSnapshot;
    rejection?: ToolRejection;
    execution: ToolExecutionSnapshot | null;
}
export interface CompletionActorOutputs {
    preparing: PreparingOutput;
    inspectPrepare: PrepareInspectionOutput;
    runPrepare: PrepareRunOutput;
    searching: SearchingOutput;
    generating: RoundDonePayload;
    resolving: ResolvingOutput;
    answering: AnsweredPayload;
    retrieving: RetrievingOutput;
    inspecting: InspectingOutput;
    rejecting: ToolDonePayload;
    approving: {
        approved: boolean;
    };
    executing: ToolDonePayload;
    batching: BatchDonePayload;
    wrapping: RoundDonePayload & {
        response: string;
    };
    finishing: void;
}
export type CompletionActorOutput = CompletionActorOutputs[keyof CompletionActorOutputs];
export type CompletionMachineEvent = {
    type: 'START';
} | {
    type: 'PAUSE';
} | {
    type: 'RESUME';
    pausedMs?: number;
} | {
    type: 'RECOVERY_REQUIRED';
    operation: Operation;
} | {
    type: 'FACTS';
    value: EngineFacts;
} | {
    type: 'FAIL';
    value: {
        error: string;
    } | Extract<EngineError, {
        tag: 'failed';
    }>;
} | {
    type: `xstate.error.actor.${string}`;
    error: EngineError;
} | {
    type: `xstate.done.actor.${string}`;
    output: CompletionActorOutput;
} | {
    type: 'OUTPUT';
    event: EngineEvent;
} | {
    type: 'INPUT';
    mode: 'steer' | 'follow-up';
    id?: string;
    text: string;
    context?: TurnContext;
    content?: string;
};
