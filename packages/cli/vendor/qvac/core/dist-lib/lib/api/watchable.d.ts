import { Readable } from 'streamx';
import type { LoggerInterface } from '@qvac/logging';
export declare function snapshotEquals(a: unknown, b: unknown): boolean;
interface WatchableStore {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    sampled?: boolean;
    once?(event: 'close', listener: () => void): unknown;
    off?(event: 'close', listener: () => void): unknown;
    closing?: unknown;
    closed?: boolean;
}
export interface WatchableOptions {
    readonly name: string;
    readonly log: LoggerInterface | null;
    readonly changes?: WatchableStore;
}
export declare function watchable<TRequest, TResult, TStore extends WatchableStore = WatchableStore>(storeOf: (request: TRequest) => TStore | null | Promise<TStore | null>, query: (request: TRequest, store: TStore) => Promise<TResult>, { name, log, changes }: WatchableOptions): (request: TRequest) => Readable & AsyncIterable<TResult>;
export {};
