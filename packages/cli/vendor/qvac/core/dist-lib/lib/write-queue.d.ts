export interface WriteQueueOptions {
    slowMs?: number;
    onSlow?: (info: {
        scope: string;
        write: string;
        waiting: number;
        afterMs: number;
    }) => void;
}
export interface PendingScope {
    readonly scope: string;
    readonly waiting: number;
}
export declare class WriteQueue {
    private readonly _scopes;
    private readonly _slowMs;
    private readonly _onSlow;
    constructor({ slowMs, onSlow }?: WriteQueueOptions);
    run<T>(name: string, write: string, task: () => Promise<T>): Promise<T>;
    pending(): Array<PendingScope>;
    private _enter;
    private _leave;
}
