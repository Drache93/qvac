import { type Patch } from './patch.ts';
import type { HistoryReference } from './protocol-types.ts';
export type { HistoryReference } from './protocol-types.ts';
export interface HistoryProjectionOptions {
    base: readonly unknown[] | undefined;
    failureRefs?: ReadonlySet<string>;
    validate?: boolean;
}
export declare function requestMessages(request: unknown): readonly unknown[] | undefined;
export declare function compactRequestHistory(messages: readonly unknown[], base: readonly unknown[] | undefined): readonly unknown[] | HistoryReference;
export declare function materializeRequestHistory(value: unknown, base: readonly unknown[] | undefined): readonly unknown[];
export declare function validateRequestHistory(value: unknown, base: readonly unknown[] | undefined): void;
export declare function compactSnapshotHistory<Value>(snapshot: Value, base: readonly unknown[] | undefined, previous?: unknown): Value;
export declare function materializeSnapshotHistory<Value>(snapshot: Value, base: readonly unknown[] | undefined): Value;
export declare function compactMachineEvent<Value>(event: Value, base: readonly unknown[] | undefined): Value;
export declare function materializeMachineEvent<Value>(event: Value, base: readonly unknown[] | undefined): Value;
export interface SnapshotHistoryValidationOptions {
    validateMachineContext?: boolean;
}
export declare function validateSnapshotHistory(snapshot: unknown, base: readonly unknown[] | undefined, options?: SnapshotHistoryValidationOptions): void;
export declare function snapshotFailureResultRefs(snapshot: unknown): ReadonlySet<string>;
export declare function validateMachineEventHistory(event: unknown, base: readonly unknown[] | undefined, failureRefs?: ReadonlySet<string>): void;
export declare function foldMachineEventHistory(previous: unknown, patch: Patch, options: HistoryProjectionOptions): unknown;
export declare function validateHistoryProjection(value: unknown, options: HistoryProjectionOptions): void;
