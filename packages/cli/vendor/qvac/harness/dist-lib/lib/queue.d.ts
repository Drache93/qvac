export interface PushQueue<T> extends AsyncIterable<T> {
    push(item: T): Promise<void>;
    end(): void;
    readonly size: number;
}
export interface PushQueueOptions {
    highWaterMark?: number;
}
export declare function pushQueue<T>({ highWaterMark }?: PushQueueOptions): PushQueue<T>;
