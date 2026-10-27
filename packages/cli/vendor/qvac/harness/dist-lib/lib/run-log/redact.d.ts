import type { Operation } from '../contract/index.ts';
import type { MachineLog } from './protocol-types.ts';
import type { ToolParameters } from '../contract/index.ts';
export declare const REDACTED = "[redacted]";
interface ToolSchema {
    name: string;
    parameters: ToolParameters;
    prompt?: {
        parameters?: ToolParameters;
    };
}
type ValueRedactor = <Value>(value: Value) => Value;
export type RunLogRedactor = ValueRedactor & {
    registerTools(tools: readonly ToolSchema[]): void;
    redactStep<Value>(step: Value): Value;
    redactRecord<Value>(record: Value): Value;
    redactShared<Value>(value: Value): Value;
    redactOperationResult<Value>(operation: Operation, result: Value): Value;
    redactToolArguments(name: string, args: Record<string, unknown>): Record<string, unknown>;
};
export declare function createRunLogRedactor(tools?: readonly ToolSchema[]): RunLogRedactor;
export declare function redact<Value>(value: Value): Value;
export declare function redactShared<Value>(value: Value): Value;
export declare function redactStep<Value>(step: Value, redactor?: RunLogRedactor): Value;
export declare function redactRecord(record: unknown, redactor?: ValueRedactor): unknown;
export declare function unredact(_snapshot: unknown, _request: unknown): void;
export declare function redactingCore<Core extends MachineLog>(core: Core, redactor?: RunLogRedactor): Core;
export {};
