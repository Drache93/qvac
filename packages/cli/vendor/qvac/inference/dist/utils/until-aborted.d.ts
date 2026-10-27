import type { AbortSignalLike } from '../schemas/common.js';
/**
 * Iterates `source` until `signal` aborts, then ends without an error. Races
 * each `next()` against the signal, since `return()` waits behind a pending
 * `next()`. A rejection after the abort is dropped.
 */
export declare function untilAborted<T>(source: AsyncGenerator<T>, signal: AbortSignalLike | undefined): AsyncGenerator<T>;
