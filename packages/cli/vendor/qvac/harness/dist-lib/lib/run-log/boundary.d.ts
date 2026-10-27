import type { Operation } from '../contract/index.ts';
import type { EngineBoot, EngineStep, RunRecord } from './protocol-types.ts';
import { RunJournal } from './run-journal.ts';
export declare const HOST_APPEND_TIMEOUT_MS = 5000;
export interface RunLogBoundaryOptions {
    boot?: EngineBoot;
    onStep?: (step: EngineStep) => Promise<void>;
    hostAppendTimeoutMs?: number;
    redact?: <Value>(value: Value) => Value;
    redactShared?: <Value>(value: Value) => Value;
    redactOperationResult?: <Value>(operation: Operation, value: Value) => Value;
    redactRecord?: (record: RunRecord) => RunRecord;
    redactStep?: (step: EngineStep) => EngineStep;
    onDetached?: (pending: Promise<void>, runId?: string) => void;
}
export declare function openBoundaryJournal(options: RunLogBoundaryOptions, runId: string): RunJournal;
export declare function boundaryBoot(journal: RunJournal): EngineBoot;
