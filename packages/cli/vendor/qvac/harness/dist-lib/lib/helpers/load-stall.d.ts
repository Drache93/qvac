export interface LoadStall {
    bump: () => void;
    clear: () => void;
    promise: Promise<never>;
}
export declare function createLoadStall(ms: number, stalled: () => Error): LoadStall;
