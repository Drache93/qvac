import type { Core, ReadOptions } from './storage';
import type { OperationOptions } from './types';
export declare class Requests {
    readonly core: Core;
    readonly options: OperationOptions;
    readonly active: object[];
    readonly config: ReadOptions;
    readonly abort: () => void;
    private cancellation;
    constructor(core: Core, options: OperationOptions);
    check(): void;
    fail(cause: unknown): never;
    close(): void;
}
