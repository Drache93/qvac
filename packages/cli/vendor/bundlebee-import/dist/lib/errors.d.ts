import type { Signal } from './options';
export declare class ImportError extends Error {
    readonly code: string;
    constructor(message: string, options: {
        readonly code: string;
        readonly cause?: unknown;
    });
}
export declare function cancelled(signal?: Signal): void;
export declare function unavailable(error: unknown, signal: Signal): boolean;
export declare function importFailure(error: unknown, options: {
    readonly signal?: Signal;
    readonly deadline?: Signal;
}): unknown;
