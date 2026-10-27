export interface DeadlineData {
    readonly state: SharedArrayBuffer;
    readonly interrupt: SharedArrayBuffer;
    readonly ms: number;
}
export declare const ARMED = 0;
export declare const DISARMED = 1;
export declare const FIRED = 2;
export declare const SIGINT = 2;
export declare const RESEND_MS = 100;
