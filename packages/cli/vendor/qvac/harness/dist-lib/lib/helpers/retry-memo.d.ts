export interface RetryMemo<T> {
    (): Promise<T>;
    peek(): Promise<T> | null;
}
export declare function retryMemo<T>(load: () => Promise<T>): RetryMemo<T>;
