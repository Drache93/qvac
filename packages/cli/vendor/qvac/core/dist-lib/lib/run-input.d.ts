export interface RunInput {
    mode: 'steer' | 'follow-up';
    text: string;
    id?: string;
}
export declare const STEERED = "steered";
export declare class RunInputQueue {
    private readonly _items;
    private _wake;
    private _closed;
    push(input: RunInput): void;
    close(): void;
    [Symbol.asyncIterator](): AsyncIterator<RunInput>;
}
