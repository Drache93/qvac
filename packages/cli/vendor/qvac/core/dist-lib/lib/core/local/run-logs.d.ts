import type HyperDB from 'hyperdb';
export declare const RUN_LOG_RETENTION_MS: number;
type Locked = <T>(fn: () => Promise<T>) => Promise<T>;
export interface RunLogStep {
    readonly seq: number;
    readonly expectedLength: number;
    readonly records: ReadonlyArray<unknown>;
}
export interface RunLogLease {
    readonly generation: string;
    readonly digestKey: Buffer;
    readonly steps: RunLogStep[];
}
export interface RunLogKey {
    readonly meshKey: Buffer;
    readonly runId: string;
}
export interface RunLogAppend extends RunLogKey {
    readonly generation: string;
    readonly step: RunLogStep;
}
export interface RunLogRelease extends RunLogKey {
    readonly generation: string;
}
export declare class LocalRunLogs {
    private readonly _db;
    private readonly _locked;
    constructor(db: HyperDB, locked: Locked);
    begin({ meshKey, runId }: RunLogKey, now?: number): Promise<RunLogLease>;
    append({ meshKey, runId, generation, step }: RunLogAppend, now?: number): Promise<void>;
    release({ meshKey, runId, generation }: RunLogRelease, now?: number): Promise<void>;
    drop(key: RunLogKey): Promise<void>;
    sweep(now?: number): Promise<number>;
    private _live;
    private _steps;
}
export declare function isRunLogStep(value: unknown): value is RunLogStep;
export {};
