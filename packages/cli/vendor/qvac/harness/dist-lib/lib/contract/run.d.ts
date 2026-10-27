export interface RunBudget {
    readonly deadlineMs: number;
    outputBytesUsed: number;
}
export interface HistoryToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface Message {
    role: string;
    content: string;
    attachments?: {
        path: string;
    }[];
    toolCalls?: HistoryToolCall[] | null;
    toolCallId?: string | null;
    name?: string | null;
    id?: string | null;
    context?: TurnContext | null;
    sentAt?: number | undefined;
    [key: string]: unknown;
}
export interface TurnContext {
    time?: string;
    excerpts?: string[];
    notes?: string;
}
export interface FailureResultReference {
    type: 'qvac-failure-result-ref';
    ref: string;
    callId: string;
    compactedTo?: number;
}
export type CompletionHistoryEntry = Message | FailureResultReference;
export interface HistorySplice {
    at: number;
    messages: CompletionHistoryEntry[];
}
export interface RunBackendUse {
    tool: string;
    requestedGpu: boolean;
    device: 'gpu' | 'cpu' | 'unknown';
    backend: string;
}
export interface PlanStep {
    step: string;
    status: 'pending' | 'in_progress' | 'done';
}
export type GoalStatus = 'open' | 'met' | 'rounds' | 'time' | 'tokens' | 'stalled';
export interface RunGoal {
    objective: string;
    rounds?: number;
    ms?: number;
    tokens?: number;
    checks?: string[];
    checksProve?: boolean;
}
export type ToolEffect = 'read' | 'write';
export type ToolDecision = 'auto' | 'allowed' | 'denied' | 'skip-all' | 'blocked';
export interface ResourceDescriptor {
    kind: string;
    label: string;
}
export type ToolActivityEvent = {
    type: 'tool-activity';
    name: string;
    args: Record<string, unknown>;
    resource: ResourceDescriptor | null;
    effect: ToolEffect;
    decision: ToolDecision;
};
export type RunOutcome = 'answered' | 'mute' | 'exhausted' | 'search-capped' | 'time-capped' | 'tool-ended' | 'delivered';
export interface ToolCallDisplay {
    readonly label: string;
    readonly description?: string;
    readonly iconEmoji?: string;
}
export type ToolExecutionOutcome = {
    readonly kind: 'success';
} | {
    readonly kind: 'error';
    readonly message?: string;
    readonly error?: unknown;
} | {
    readonly kind: 'denied';
    readonly reason?: string;
} | {
    readonly kind: 'blocked';
    readonly reason?: string;
} | {
    readonly kind: 'guidance';
    readonly message: string;
};
export interface HookRejection {
    kind: 'hook-rejection';
    hook: string;
    phase: 'preToolCall' | 'postToolCall' | 'runStart' | 'runEnd' | 'runPause' | 'runResume' | 'promptSubmit' | 'toolFailure' | 'stop' | 'preFold';
    error: string;
    guidance: true;
}
export type TrustedOrigin = 'user' | 'tool-result' | 'skill';
export interface TrustedSource {
    origin: TrustedOrigin;
    text: string;
}
export interface TrustedSourceFacts {
    origin: Exclude<TrustedOrigin, 'user'>;
    addresses: string[];
    refused: boolean;
}
export interface Operation {
    id: string;
    name: string;
    args: unknown;
    effect: 'read' | 'write';
    reason?: string;
}
export type RunLifecycleEvent = {
    type: 'run-started';
    runId: string;
    parentRunId?: string;
} | {
    type: 'run-resumed' | 'paused';
    runId: string;
} | {
    type: 'round-reset';
    runId: string;
    round: number;
    replacedTypes?: ('content' | 'thinking')[];
} | {
    type: 'recovery-required';
    runId: string;
    operation: Operation;
};
export interface RoundSpeed {
    round: number;
    durationMs: number;
    promptTokens?: number;
    cacheTokens?: number;
    generatedTokens?: number;
    promptTokensPerSecond?: number;
    tokensPerSecond?: number;
    timeToFirstToken?: number;
    stopReason?: string;
    overflows?: number;
    contextBoundary?: true;
    reasoningDeltas?: number;
    rawContentChars?: number;
    kind?: 'streaming' | 'wrap-up';
}
export interface ToolSpeed {
    round: number;
    name: string;
    durationMs: number;
}
