export interface IdleReaperOptions {
    sweep: () => Promise<void>;
    waitMs: number;
    onError: (err: unknown) => void;
    now?: () => number;
    tickMs?: number;
}
export interface IdleReaper {
    configure(timeoutMs: number): void;
    enter(): Promise<void>;
    exit(): void;
    close(): void;
}
export declare function createIdleReaper({ sweep, waitMs, onError, now, tickMs }: IdleReaperOptions): IdleReaper;
