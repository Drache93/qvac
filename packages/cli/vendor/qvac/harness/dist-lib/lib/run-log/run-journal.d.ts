import type { LoggedRequest, MachineLog, ModelRequest } from './protocol-types.ts';
import type { Operation } from '../contract/index.ts';
import { RecoveryRequired } from '../helpers/engine-error.ts';
import { type Patch } from './patch.ts';
import { RUN_LOG_VERSION, pendingCallNames, pendingToolArgs, unsettledRedactedIds, type EngineBoot, type EngineStep, type ForkOrigin, type ForkSegment, type Receipt, type RecoveryResolution, type RunRecord } from './protocol.ts';
export { RUN_LOG_VERSION, RecoveryRequired, type Operation, pendingCallNames, pendingToolArgs, unsettledRedactedIds };
export declare const XSTATE_VERSION: string;
export declare const ENGINE_BOUNDARY_BOOT: unique symbol;
export type { EngineBoot, EngineStep, ForkOrigin, ForkSegment, Receipt, RecoveryResolution, RunRecord };
export declare class RunIncompatible extends Error {
    readonly runId: string | undefined;
    readonly found: number | string;
    readonly expected: number | string;
    readonly kind: 'machine' | 'log' | 'xstate';
    constructor(opts: RunIncompatibleOptions);
}
interface RunIncompatibleOptions {
    runId?: string;
    found: number | string;
    expected: number | string;
    kind: 'machine' | 'log' | 'xstate';
}
export type { MachineTransitionTrace } from './protocol.ts';
export declare function unresolvedWriteIds(receipts: Iterable<Receipt>): string[];
export declare function forkRepeatsSettledWrite(receipts: Iterable<Receipt>, forkBeforeWrite: ReadonlyMap<string, number>, forkAt: number | null): boolean;
export declare function safeForkLength(receipts: Iterable<Receipt>, forkBeforeWrite: ReadonlyMap<string, number>, unredactedLength: number): number | null;
export declare function recoveryAdvice(ids: readonly string[], receipts: Iterable<Receipt>, redactedPendingIds: readonly string[]): string;
interface OperationFactsAdapter {
    capture(): unknown;
    restore(value: unknown): void;
}
interface OperationSignal {
    readonly aborted: boolean;
}
export interface ReadRunLogOptions {
    anyMachine?: boolean;
}
export interface RunLogInspectionEntry {
    index: number;
    record: RunRecord;
    snapshot: unknown;
    events: Record<string, unknown>[];
}
export declare class RunJournal {
    snapshotSavedAt: number | undefined;
    firstSavedAt: number | undefined;
    deltasSinceCheckpoint: number;
    redactedPendingArgs: boolean | null;
    unredactedLength: number;
    private restoredRedacted;
    private readonly forkBeforeWrite;
    knownLength: number;
    metadata: Extract<RunRecord, {
        type: 'metadata';
    }> | undefined;
    readonly receipts: Map<string, Receipt>;
    private readonly intentArgs;
    private tail;
    private readonly requests;
    private settledTail;
    uncertainWrite(): (Operation & {
        facts?: unknown;
        status: 'intent' | 'retry';
    }) | undefined;
    failure: Error | null;
    detachedEffects: Promise<void> | null;
    sealed: boolean;
    onFailure?: (error: Error) => void;
    readonly core: MachineLog;
    restored: boolean;
    private readonly redact;
    private readonly redactShared;
    private readonly redactOperationResult;
    private readonly redactRecord?;
    private readonly hasRedactionProvenance;
    private readonly initialBoot?;
    private engineBoot;
    private compactedSnapshot;
    get snapshot(): unknown;
    get requestHistoryBase(): readonly unknown[] | undefined;
    compactSnapshot(snapshot: unknown): unknown;
    constructor(core: MachineLog, opts?: RunJournalOptions);
    redactValue<Value>(value: Value): Value;
    restore(): Promise<void>;
    private assertCompatibleBoot;
    private restoreBoot;
    exportBoot(): EngineBoot;
    exportSnapshot(): unknown;
    private trackForkPoint;
    settledCall(receiptId: string): boolean;
    private unresolvedWriteIds;
    redactedPendingCallIds(snapshot: unknown): string[];
    private safeForkLength;
    getReceipt(receiptId: string): Receipt | undefined;
    commitResultFacts(receiptId: string, facts: unknown): Promise<void>;
    retryLifecycleReceipts(): Receipt[];
    pendingArgumentsWereRedacted(snapshot: unknown): boolean | null;
    append(record: RunRecord): Promise<void>;
    private fail;
    hasPendingFlush(): boolean;
    flush(): Promise<void>;
    resolve(resolutions: readonly RecoveryResolution[]): Promise<void>;
    recordRequest(request: ModelRequest): Promise<void>;
    operation<Result>(operation: Operation, execute: () => Promise<Result>, facts?: OperationFactsAdapter, signal?: OperationSignal): Promise<Result>;
}
interface RunJournalOptions {
    redact?: <Value>(value: Value) => Value;
    redactShared?: <Value>(value: Value) => Value;
    redactOperationResult?: <Value>(operation: Operation, value: Value) => Value;
    redactRecord?: (record: RunRecord) => RunRecord;
    boot?: EngineBoot;
}
export declare function acquireRun(owner: object, runId: string): () => void;
export declare class EventCodec {
    private base;
    private readonly historyBase;
    constructor(historyBase?: readonly unknown[]);
    reset(): void;
    encode(event: unknown): Patch;
    decode(patch: Patch): Record<string, unknown>;
    private merge;
}
export declare class RunLogFold {
    boot: EngineBoot;
    private codec;
    private readonly anyMachine;
    constructor(opts?: ReadRunLogOptions);
    add(raw: unknown): RunLogInspectionEntry;
}
export declare function readRunLog(core: MachineLog, opts?: ReadRunLogOptions): AsyncGenerator<RunLogInspectionEntry>;
export declare function readRequests(core: MachineLog): AsyncGenerator<LoggedRequest>;
