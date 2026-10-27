import type { EngineBoot, EngineStep, Receipt, RunRecord } from './protocol-types.ts';
export declare const RUN_LOG_PROTOCOL_VERSION: 1;
export declare const RUN_LOG_VERSION: 1;
export type { EngineBoot, EngineStep, ForkOrigin, ForkSegment, HostRunLog, HostRunLogLease, HistoryReference, MachineTransitionTrace, Operation, Patch, Receipt, RecoveryResolution, RunBudget, RunRecord } from './protocol-types.ts';
export declare class InvalidEngineStep extends Error {
    constructor(message: string);
}
export declare function pendingToolArgs(snapshot: unknown, settled?: (receiptId: string) => boolean): unknown[];
export declare function pendingCallNames(snapshot: unknown): Map<string, string>;
export declare function pendingCallArgs(snapshot: unknown, settled?: (receiptId: string) => boolean): Map<string, unknown>;
export declare function unsettledRedactedIds(redactedPendingIds: readonly string[], receipts: Iterable<Receipt>): string[];
export declare function createEngineBoot(): EngineBoot;
export declare function prepareEngineBoot(value?: EngineBoot): EngineBoot;
export declare function captureRunRecord(record: unknown): RunRecord;
export declare function brandCapturedRecord<Value>(value: Value): Value;
export declare function isCapturedJson(value: unknown): boolean;
export declare function createEngineStep(seq: number, expectedLength: number, records: readonly RunRecord[]): EngineStep;
export declare function captureEngineStep(step: EngineStep): EngineStep;
export declare function requestFromBoot(boot: EngineBoot): unknown;
export declare function contextFromBoot(boot: EngineBoot): unknown;
export interface BuildEngineBootOptions {
    nextSeq: number;
}
export declare function buildEngineBoot(records: readonly RunRecord[], opts: BuildEngineBootOptions): EngineBoot;
export declare function applyEngineStep(boot: EngineBoot, step: EngineStep): EngineBoot;
export declare function validateEngineBoot(boot: EngineBoot): void;
