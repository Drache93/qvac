import { HarnessError } from '../errors.ts';
import type { Operation } from '../contract/run.ts';
export declare class RecoveryRequired extends Error {
    readonly operation: Operation;
    constructor(operation: Operation);
}
export declare class HookHalt extends Error {
    readonly code = "hook-halt";
    readonly hook: string;
    constructor(reason: string, hook: string);
}
export declare class AbortedError extends HarnessError<'ABORTED'> {
    constructor();
}
export interface ErrorCause {
    message: string;
    name: string;
    code?: string;
    stack?: string;
    cause?: ErrorCause;
}
export type EngineError = {
    tag: 'recovery';
    message: string;
    name: string;
    operation: Operation;
    stack?: string;
} | {
    tag: 'aborted';
    message: string;
    name: string;
    stack?: string;
} | {
    tag: 'failed';
    message: string;
    name: string;
    code?: string;
    stack?: string;
    cause?: ErrorCause;
};
export declare function tagError(error: unknown): EngineError;
export declare function rehydrateError(value: EngineError | ErrorCause | null | undefined, fallbackMessage?: string): Error;
