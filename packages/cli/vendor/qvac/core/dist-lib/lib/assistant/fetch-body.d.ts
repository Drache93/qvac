import defaultFetch from '#fetch';
import { type AbortSignal } from 'bare-abort-controller';
export type FetchBody = Awaited<ReturnType<typeof defaultFetch>>['body'];
export declare function raceInactivity<T>(promise: Promise<T>, signal: AbortSignal | undefined, timeoutMs: number): Promise<T>;
export declare function drainBody(body: FetchBody, signal: AbortSignal | undefined, timeoutMs: number): Promise<Uint8Array | null>;
