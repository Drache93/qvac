import type { ViewHead } from '../mesh.ts';
export interface ViewUpdate {
    readonly from: ViewHead | null;
    readonly to: number;
    readonly incremental: boolean;
}
export interface PendingUpdates {
    read(): Promise<ViewUpdate | null>;
    write(update: ViewUpdate): Promise<void>;
    clear(): Promise<void>;
}
type Run = (update: ViewUpdate) => Promise<ViewHead | null | void>;
export declare class ViewUpdates {
    private readonly _run;
    private readonly _pending;
    private _next;
    private _running;
    private _kept;
    private _started;
    private _closed;
    constructor(run: Run, pending?: PendingUpdates | null);
    start(): Promise<void>;
    push(update: ViewUpdate): Promise<void>;
    close(): void;
    flush(): Promise<void>;
    private _kick;
    private _drain;
    private _queue;
    private _keepNext;
    private _keep;
    private _clear;
}
export {};
