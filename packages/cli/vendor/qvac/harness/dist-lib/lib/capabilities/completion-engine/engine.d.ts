import { type SnapshotFrom } from 'xstate';
import { type EngineBoot, type ModelRequest, type RecoveryResolution, type Receipt, type RunLogBoundaryOptions } from '../../run-log/index.ts';
import { type FailureTurn } from '../tool-turns.ts';
import type { EnginePorts, InvokeTracker } from './ports.ts';
import type { Operation, RunBudget, RunInput } from '../../contract/index.ts';
import { type CompletionContext, CompletionMachine, type EngineEvent } from '../../machine/index.ts';
export type CompletionSnapshot = SnapshotFrom<ReturnType<typeof CompletionMachine.create>>;
export interface SubmittedInput extends RunInput {
    notes?: string;
}
export type EngineInput = SubmittedInput | {
    reason: string;
};
export interface EngineRun {
    runId: string;
    parentRunId?: string;
    resume?: boolean;
    recovery?: RecoveryResolution[];
    request?: unknown;
    requestDigest?: string;
    budget: RunBudget;
    signal?: AbortSignal;
    input?: AsyncIterable<EngineInput>;
    lockOwner?: object;
    now?(): number;
    start(run: {
        operations: EngineOperationPort;
        invokes: InvokeTracker;
        boot: EngineBoot;
    }): Promise<{
        ports: EnginePorts;
        context: CompletionContext;
    }>;
    settled?(snapshot: CompletionSnapshot): void;
}
export interface EngineOperationPort {
    flush(): Promise<void>;
    operation<Result>(operation: Operation, execute: () => Promise<Result>, facts?: OperationFactsPort, signal?: {
        readonly aborted: boolean;
    }): Promise<Result>;
    getReceipt(id: string): Receipt | undefined;
    commitResultFacts(id: string, facts: unknown): Promise<void>;
    uncertainWrite(): Operation | undefined;
    settledCall(receiptId: string): boolean;
    pendingArgumentsWereRedacted(snapshot: unknown): boolean | null;
    recordRequest(request: ModelRequest, failures: readonly FailureTurn[]): Promise<void>;
}
export interface OperationFactsPort {
    capture(): unknown;
    restore(value: unknown): void;
}
export interface EngineBoundaryOptions extends RunLogBoundaryOptions {
    lockOwner?: object;
}
export type EngineResult = {
    status: 'replayed';
} | {
    status: 'paused';
    snapshot: CompletionSnapshot;
} | {
    status: 'done';
    snapshot: CompletionSnapshot;
} | {
    status: 'error';
    snapshot: CompletionSnapshot;
    error: unknown;
};
export declare function runEngine(run: EngineRun, options?: EngineBoundaryOptions): AsyncGenerator<EngineEvent, EngineResult>;
