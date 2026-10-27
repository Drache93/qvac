export interface RetryBudgetOptions {
    retryMs?: number;
}
export declare class RetryBudget {
    private readonly _retryMs;
    private readonly _attempts;
    private readonly _readyAt;
    constructor({ retryMs }?: RetryBudgetOptions);
    ready(name: string, now: number): boolean;
    nextDeadline(names: ReadonlySet<string>, now: number): number | null;
    reset(name: string): void;
    retain(names: ReadonlySet<string>): void;
    fail(name: string, now: number): number;
}
