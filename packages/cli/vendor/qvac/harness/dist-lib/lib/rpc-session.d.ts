export interface Stream {
    destroyed?: boolean;
    destroy(): void;
    on(event: 'close', listener: () => void): unknown;
    on(event: 'error', listener: (err: unknown) => void): unknown;
}
export type Transport = () => Stream | Promise<Stream>;
export declare function settleOnClose<T>(hrpc: T): T;
