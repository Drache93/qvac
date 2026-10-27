import { type GuardedFetch, type GuardedFetchOptions } from '../../lib/guarded-fetch.ts';
declare const GUARDED: unique symbol;
export interface ConnectPolicy {
    readonly named?: readonly string[] | undefined;
    readonly ask: (host: string) => Promise<boolean>;
    readonly allowed?: readonly string[] | undefined;
}
export declare function setConnectPolicy(next: ConnectPolicy | null): void;
export declare function isGuardedFetch(fetch: unknown): boolean;
type MarkedFetch = GuardedFetch & {
    readonly [GUARDED]: true;
};
export declare function createGuardedFetch(options?: Omit<GuardedFetchOptions, 'mayConnect'>): MarkedFetch;
export {};
