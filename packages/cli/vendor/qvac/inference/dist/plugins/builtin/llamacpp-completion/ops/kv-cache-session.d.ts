import { generateConfigHash } from '../../../ops/kv-cache-utils.js';
import { type CacheMessage } from '../../../../utils/index.js';
import type { Tool } from '../../../../schemas/tools.js';
import type { Logger } from '../../../../logging/types.js';
import { type AbortSignal } from 'bare-abort-controller';
export interface TurnHandle {
    /** Resolved on-disk cache file path the addon will read from / write to. */
    readonly cachePath: string;
    /**
     * True when no cache existed at this path when the turn began: nothing
     * committed is there to keep, so an unwind drops whatever this turn wrote.
     */
    readonly createdCache: boolean;
}
export interface BeginCustomTurnInput {
    kind: 'custom';
    /** User-provided session key (`completion({ kvCache: "session-a" })`). */
    customKey: string;
    /** Hash of the system prompt; see `generateConfigHash`. */
    configHash: string;
    /**
     * Request abort signal. When it aborts while this turn is queued behind a
     * same-file peer's write lock, the wait is abandoned so the request's scope
     * unwinds and releases its admission slot instead of blocking on the holder.
     */
    signal?: AbortSignal;
}
export interface BeginAutoTurnInput {
    kind: 'auto';
    /** Hash of the system prompt; see `generateConfigHash`. */
    configHash: string;
    /** Conversation history used to compute the pre-response cache key. */
    history: CacheMessage[];
    /** Rendered tools that distinguish prefixes with no assistant message. */
    tools?: readonly Tool[];
    /** See `BeginCustomTurnInput.signal`. */
    signal?: AbortSignal;
}
export type BeginTurnInput = BeginCustomTurnInput | BeginAutoTurnInput;
export interface StaticCommitResult {
    kind: 'static';
}
export interface AutoRenameCommitResult {
    kind: 'autoRename';
    /**
     * Destination path for the history covered by the saved cache.
     */
    targetCachePath: string;
}
export type CommitResult = StaticCommitResult | AutoRenameCommitResult;
export interface KvCacheSession {
    /**
     * Open a new turn against the cache. Resolves the cache file path,
     * ensures its parent directory exists, and returns a `TurnHandle` the
     * handler attaches to `ctx.scope.defer(...)` for the rollback hook. The
     * addon's `saveCache` writes the file after the run, so a cold turn opens
     * without one. Auto-cache path resolution is serialized with
     * retention deletion before the handle is returned.
     */
    beginTurn(input: BeginTurnInput): Promise<TurnHandle>;
    /**
     * Commit a turn — verifies the addon saved the cache file, records it as
     * established, and (for auto-cache turns) renames the addon's pre-response
     * file to the post-response path. Flips the turn's internal `committed`
     * flag so the deferred `rollback` becomes a no-op.
     */
    commitTurn(turn: TurnHandle, result: CommitResult): Promise<void>;
    /**
     * Roll back an in-flight turn — atomically deletes the on-disk cache
     * file, drops the addon's copy of the conversation through
     * `options.discardCache`, clears the in-memory `initializedCaches` entry,
     * releases the active-path ref, and removes orphaned marker metadata.
     * Idempotent: a turn that has already been committed or rolled back is a
     * no-op on subsequent calls. Handlers register this via
     * `ctx.scope.defer(...)` so it runs regardless of how the handler exits
     * (success branch removes itself via `commitTurn`).
     */
    rollback(turn: TurnHandle): Promise<void>;
    /**
     * Non-destructive counterpart of `rollback`: releases locks and refs but
     * keeps the committed disk cache for a retry. A cache this same turn
     * created rolls back instead.
     */
    releaseTurn(turn: TurnHandle): Promise<void>;
}
/**
 * Construct a session bound to one `(modelId, turn-owning request)`
 * scope. `options.logger` is the per-instance logger the session emits
 * through (typically `withRequestContext(getEngineLogger(), ctx)`);
 * falls back to the module-scoped logger when omitted. `options.discardCache`
 * drops the addon's copy of a conversation whose cache the session rolls
 * back; without it the addon writes that conversation to the deleted path at
 * its next key switch or unload.
 */
export declare function createKvCacheSession(modelId: string, options?: {
    logger?: Logger;
    discardCache?: (cachePath: string) => Promise<void>;
}): KvCacheSession;
/**
 * Atomically delete every layer of KV-cache state for a
 * `(kvCacheKey, modelId)` pair, wipe everything, or reclaim the auto
 * caches no turn is holding. Single entry point — the only mutation
 * point for cross-model state outside of turn-scoped
 * `commitTurn`/`rollback`.
 *
 * Why this isn't a method on `KvCacheSession`: deletes are
 * cross-model (`all: true` has no model; the keyed form has
 * `modelId` optional in the request). A session, by contrast, is
 * created with a *fixed* `modelId` for the duration of a turn. Making
 * delete a method would force callers to materialise an irrelevant
 * session for cross-model administrative cleanups.
 *
 * Layers cleared, in order:
 *   1. On-disk: `deleteCache(...)` removes the matching directory
 *      tree (or wipes and recreates the root for `all: true`).
 *   2. `initializedCaches`: prefix-cleanup by the removed directory,
 *      since it is keyed by the resolved cache path.
 *
 * Concurrency with in-flight turns: this delete does not take the
 * per-cache-path write locks, so it races any turn holding a `TurnHandle`
 * for the same key. Deleting a key that is in active use is unsupported.
 * Each individual mutation is idempotent (`unlink` no-ops if missing,
 * `Map.delete` / `Set.delete` no-op on absent keys), but the layers are
 * cleared without a lock, so an interleaving that lands the delete's
 * in-memory cleanup after a concurrent turn has already renamed/committed
 * its file splits state: the file stays on disk while its init flag is
 * cleared. Callers must not delete a key that is in active use.
 * The `auto` target is the exception: it skips keys an in-flight turn holds
 * and clears each one under the cache-state lock.
 */
export declare function deleteKvCacheState(target: {
    kvCacheKey: string;
    modelId?: string;
} | {
    all: true;
} | {
    auto: true;
}): Promise<void>;
/**
 * Test-only access to the module-scoped state. Production code reaches
 * for cache state exclusively through the session API; the unit suite
 * for `kv-cache-session.test.ts` needs to seed and inspect raw state
 * to assert the rollback / commit invariants. Not part of the public
 * surface.
 *
 * @internal
 */
export declare const __kvCacheSessionTestHooks: {
    hasInitializedPath(cachePath: string): boolean;
    getActivePathCountForTest(cachePath: string): number;
    getLastAutoCacheSweepMsForTest(): number;
    setLastAutoCacheSweepMsForTest(value: number): void;
    resetForTest(): void;
    waitForAutoCacheSweepForTest(): Promise<void>;
    sweepAutoCachesForTest(options: {
        maxBytes: number;
        maxIdleMs: number;
        nowMs: number;
    }): Promise<void>;
};
export { generateConfigHash };
