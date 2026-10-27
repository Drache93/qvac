export interface InterruptTimer {
    readonly interrupt: Uint8Array;
    disarm(): boolean;
}
export declare function startInterruptTimer(ms: number): InterruptTimer;
