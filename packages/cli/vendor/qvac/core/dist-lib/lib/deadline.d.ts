export declare class DeadlineScheduler {
    private readonly _onFire;
    private _timer;
    private _at;
    constructor(onFire: () => void);
    get at(): number | null;
    schedule(deadline: number): void;
    clear(): void;
}
