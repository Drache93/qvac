export interface Closeable {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    off(event: string, listener: (...args: unknown[]) => void): unknown;
}
export declare function raceResource<T>(resource: Closeable, operation: Promise<T>, name: string): Promise<T>;
