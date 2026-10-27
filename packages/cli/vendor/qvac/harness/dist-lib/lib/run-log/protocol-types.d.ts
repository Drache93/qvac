import type { Operation, RunBudget } from '../contract/index.ts';
import type { CompletionParams } from '../helpers/completion-params.ts';
export type { Operation, RunBudget };
export interface ModelRequest {
    round: number;
    attempt: number;
    droppedTurns: number;
    params: CompletionParams;
}
export interface LoggedRequest extends ModelRequest {
    index: number;
}
export type Patch = {
    $: unknown;
} | {
    o: Record<string, Patch>;
    d?: string[];
} | {
    t: number;
    a: unknown[];
};
export interface HistoryReference {
    $qvacHistory: {
        version: 1;
        base: 'request.messages';
        items: ({
            index: number;
        } | {
            inline: unknown;
        })[];
    };
}
export type RecoveryResolution = {
    operationId: string;
    decision: 'retry';
} | {
    operationId: string;
    decision: 'result';
    result: unknown;
} | {
    operationId: string;
    decision: 'skip';
};
export interface ForkOrigin {
    runId: string;
    length: number;
    key?: string;
}
export interface ForkSegment {
    key: string;
    length: number;
}
export interface MachineTransitionTrace {
    eventType: string;
    sourceIds: string[];
    targetIds: string[];
    guardNames: string[];
    actionNames: string[];
}
export type Receipt = (Operation & {
    facts?: unknown;
    status: 'intent' | 'retry';
}) | {
    id: string;
    name: string;
    effect: Operation['effect'];
    facts?: unknown;
    status: 'result';
    result: unknown;
    resultUndefined?: true;
    abandoned?: true;
};
export type RunRecord = {
    version: 1;
    type: 'metadata';
    runId: string;
    request: unknown;
    requestDigest?: string;
    digestRunId?: string;
    budget: RunBudget;
    machine: number;
    definition?: unknown;
    xstate?: string;
    forkedFrom?: ForkOrigin;
    startedAt?: number;
} | {
    version: 1;
    type: 'fork';
    runId: string;
    forkedFrom: ForkOrigin;
    request?: Record<string, unknown>;
    segments?: ForkSegment[];
} | {
    version: 1;
    type: 'checkpoint';
    snapshot: unknown;
    savedAt: number;
    redactedPendingArgs?: boolean;
    redactedPendingIds?: string[];
    events?: Patch[];
    trace?: MachineTransitionTrace[];
    reset?: true;
} | {
    version: 1;
    type: 'delta';
    patch?: Patch;
    savedAt: number;
    redactedPendingArgs?: boolean;
    redactedPendingIds?: string[];
    events: Patch[];
    trace?: MachineTransitionTrace[];
    reset?: true;
} | {
    version: 1;
    type: 'operation';
    receipt: Receipt;
} | {
    version: 1;
    type: 'request';
    round: number;
    attempt: number;
    droppedTurns: number;
    keep: number;
    messages: readonly unknown[] | HistoryReference;
    tools?: {
        ref: string;
        block?: CompletionParams['tools'];
    };
    params: Pick<CompletionParams, 'modelId' | 'generationParams' | 'responseFormat' | 'toolDialect' | 'kvCache'>;
};
export type RequestRecord = Extract<RunRecord, {
    type: 'request';
}>;
export interface EngineStep {
    seq: number;
    expectedLength: number;
    records: readonly RunRecord[];
}
export interface EngineBoot {
    protocolVersion: 1;
    length: number;
    nextSeq: number;
    machineVersion: number | null;
    xstateVersion: string | null;
    metadata: Extract<RunRecord, {
        type: 'metadata';
    }> | null;
    snapshot?: unknown;
    eventState: unknown | null;
    snapshotSavedAt?: number;
    firstSavedAt?: number;
    deltasSinceCheckpoint: number;
    redactedPendingArgs: boolean | null;
    redactedPendingIds: string[];
    unredactedLength: number;
    restoredRedacted: boolean;
    forkBeforeWrite: Array<[string, number]>;
    receipts: Receipt[];
    intentArgs: Array<[string, unknown]>;
}
export interface HostRunLogLease {
    generation: string;
    boot?: EngineBoot;
    digestKey: Uint8Array;
}
export interface HostRunLog {
    begin(runId: string): Promise<HostRunLogLease>;
    append(runId: string, generation: string, step: EngineStep): Promise<void>;
    release(runId: string, generation: string): Promise<void>;
}
export interface MachineLog {
    ready(): Promise<void>;
    readonly length: number;
    get(index: number): Promise<unknown>;
    append(value: unknown): Promise<unknown>;
}
