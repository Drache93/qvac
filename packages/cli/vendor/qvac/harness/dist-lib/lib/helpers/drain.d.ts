export declare const EFFECT_DRAIN_TIMEOUT_MS = 5000;
declare const TIMED_OUT: unique symbol;
export declare function raceDrain<T>(promise: Promise<T>, timeoutMs?: number): Promise<T | typeof TIMED_OUT>;
export declare function didDrainTimeOut(value: unknown): value is typeof TIMED_OUT;
export {};
