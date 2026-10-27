interface EventStream<T> {
    on(event: 'data', listener: (chunk: T) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    resume?(): void;
    off?: {
        (event: 'data', listener: (chunk: T) => void): void;
        (event: 'end', listener: () => void): void;
        (event: 'error', listener: (error: Error) => void): void;
    };
}
export declare function toAsyncIterable<T>(streamOrIterable: AsyncIterable<T> | EventStream<T>): AsyncIterable<T>;
export {};
