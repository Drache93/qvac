import { promises as fsPromises } from 'bare-fs';
import path from 'bare-path';
import { findMatchingCache, generateConfigHash, getCacheFilePath, getCurrentCacheInfo, pruneEmptyCacheDirectories, renameCacheFile, deleteCache as deleteCacheUtil } from '../../../ops/kv-cache-utils.js';
import { isCachePathWithinDirectory, markAutoCacheKey, planAutoCacheEvictions, removeAutoCacheMarker, removeAutoCacheMarkerIfMissing } from '../../../ops/kv-cache-retention.js';
import { isMobile } from '../../../../runtime/state.js';
import { getKVCacheDir } from '../../../../utils/index.js';
import { logCacheSaveError, logCacheStatus } from './cache-logger.js';
import { getEngineLogger } from '../../../../logging/index.js';
// Used by cross-model paths that have no `RequestContext` (e.g.
// `deleteKvCacheState`). Per-session call sites receive a logger from
// the caller — typically `withRequestContext(...)`.
const moduleLogger = getEngineLogger();
/**
 * Coordinates four KV-cache state layers:
 *
 * 1. `initializedCaches` — caches this process has established.
 * 2. On-disk `.bin` files written by the addon. Each one records the tokens
 *    it holds, and the addon reuses the longest prefix the next prompt
 *    shares with it, so nothing here tracks what a file covers.
 * 3. `activeCachePaths` — per-path refs that block in-flight eviction.
 * 4. `.auto-cache-<key>` markers — engine-generated cache ownership.
 *
 * Every turn must finish through `commitTurn`, `rollback`, or the
 * non-destructive `releaseTurn` so all inference state stays aligned,
 * the active-path ref is released, and marker metadata follows the
 * cache directory lifecycle.
 */
// ----- module-scoped state. The session is the single mutation point
// for the in-memory KV-cache bookkeeping. -----
/**
 * In-memory registry of caches established this session, recorded once a save
 * is verified. The addon defers disk writes, so the absence of a `.bin` file on
 * disk isn't proof that no cache exists for this process. Keyed by the resolved
 * cache path, so aliased keys that name one file share an entry and on-disk
 * caches from older process runs still hit the lazy-load path in `beginTurn`.
 */
const initializedCaches = new Set();
const activeCachePaths = new Map();
const DESKTOP_AUTO_CACHE_MAX_BYTES = 4 * 1024 * 1024 * 1024;
const MOBILE_AUTO_CACHE_MAX_BYTES = 512 * 1024 * 1024;
const AUTO_CACHE_MAX_IDLE_MS = 24 * 60 * 60 * 1000;
const AUTO_CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastAutoCacheSweepMs = 0;
let autoCacheSweepInFlight = null;
let cacheStateLockTail = Promise.resolve();
const cachePathLocks = new Map();
// Internal sentinel so acquisition paths prune directories/markers only when a
// queued lock wait was aborted, not when lock acquisition failed for another
// reason.
class CacheLockAbortError extends Error {
    constructor(cause) {
        super('cache lock wait aborted', cause !== undefined ? { cause } : undefined);
        this.name = 'CacheLockAbortError';
    }
}
// Case-fold the lock-map key so case-only path variants (e.g. "Session" vs
// "session"), which name the SAME file on case-insensitive filesystems (default
// macOS/Windows), serialise on one lock and can't interleave writes. Over-locks
// case-only variants on case-sensitive filesystems, which is safe. NOTE: the
// other per-path bookkeeping (activeCachePaths, initializedCaches, retention)
// stays case-sensitive, so case-only key variants are otherwise unsupported —
// see the KV-cache system doc.
function lockKeyFor(cachePath) {
    return cachePath.toLowerCase();
}
function releaseCachePathWriteLock(lockKey) {
    const lock = cachePathLocks.get(lockKey);
    if (!lock)
        return;
    const next = lock.waiters.shift();
    if (next) {
        next.grant();
        return;
    }
    lock.held = false;
    cachePathLocks.delete(lockKey);
}
// Returns the release fn. Aborting while queued rejects and removes the waiter.
async function acquireCachePathWriteLock(cachePath, signal) {
    const lockKey = lockKeyFor(cachePath);
    let lock = cachePathLocks.get(lockKey);
    if (!lock) {
        lock = { held: false, waiters: [] };
        cachePathLocks.set(lockKey, lock);
    }
    if (!lock.held) {
        lock.held = true;
        return () => releaseCachePathWriteLock(lockKey);
    }
    await new Promise((resolve, reject) => {
        const waiter = {
            grant: () => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
            },
            drop: (reason) => reject(reason)
        };
        const onAbort = () => {
            const index = lock.waiters.indexOf(waiter);
            if (index !== -1)
                lock.waiters.splice(index, 1);
            waiter.drop(new CacheLockAbortError(signal?.reason));
        };
        if (signal?.aborted) {
            onAbort();
            return;
        }
        lock.waiters.push(waiter);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
    return () => releaseCachePathWriteLock(lockKey);
}
function markCachePathActive(cachePath) {
    activeCachePaths.set(cachePath, (activeCachePaths.get(cachePath) ?? 0) + 1);
}
function releaseCachePath(cachePath) {
    const count = activeCachePaths.get(cachePath);
    if (count === undefined)
        return;
    if (count === 1) {
        activeCachePaths.delete(cachePath);
        return;
    }
    activeCachePaths.set(cachePath, count - 1);
}
// Paths in-flight turns hold, so pruning skips a directory still in use.
function snapshotActivePaths() {
    return Array.from(activeCachePaths.keys());
}
function isCacheKeyActive(cacheKey) {
    const cacheDirectory = path.join(getKVCacheDir(), cacheKey);
    return Array.from(activeCachePaths.keys()).some((cachePath) => isCachePathWithinDirectory(cacheDirectory, cachePath));
}
function getAutoCacheMaxBytes() {
    return isMobile() ? MOBILE_AUTO_CACHE_MAX_BYTES : DESKTOP_AUTO_CACHE_MAX_BYTES;
}
/**
 * Deletes planned auto-cache keys and reports how many went.
 *
 * Planning and eviction are separate steps, so a turn can take a key in
 * between: each one is re-checked against the active paths under the
 * cache-state lock rather than trusted from the plan.
 */
async function evictPlannedAutoCaches(cacheKeys) {
    let evicted = 0;
    await withCacheStateLock(async () => {
        for (const cacheKey of cacheKeys) {
            if (isCacheKeyActive(cacheKey))
                continue;
            await deleteKvCacheState({ kvCacheKey: cacheKey });
            evicted++;
        }
    });
    return evicted;
}
async function withCacheStateLock(operation) {
    const previous = cacheStateLockTail;
    let releaseLock = () => { };
    cacheStateLockTail = new Promise((resolve) => {
        releaseLock = resolve;
    });
    await previous;
    try {
        return await operation();
    }
    finally {
        releaseLock();
    }
}
async function maybeSweepAutoCaches(logger, overrides) {
    const nowMs = overrides?.nowMs ?? Date.now();
    if (autoCacheSweepInFlight !== null) {
        await autoCacheSweepInFlight;
        if (!overrides?.force)
            return;
        return maybeSweepAutoCaches(logger, overrides);
    }
    if (!overrides?.force && nowMs - lastAutoCacheSweepMs < AUTO_CACHE_SWEEP_INTERVAL_MS)
        return;
    lastAutoCacheSweepMs = nowMs;
    const sweep = async () => {
        try {
            const cacheKeys = await planAutoCacheEvictions({
                activeCachePaths: snapshotActivePaths(),
                maxBytes: overrides?.maxBytes ?? getAutoCacheMaxBytes(),
                maxIdleMs: overrides?.maxIdleMs ?? AUTO_CACHE_MAX_IDLE_MS,
                nowMs
            });
            const evictionCount = await evictPlannedAutoCaches(cacheKeys);
            if (evictionCount > 0) {
                logger.debug(`[kv-cache] Evicted ${evictionCount} inactive auto-cache entries`);
            }
        }
        catch (error) {
            logger.warn(`[kv-cache] Auto-cache retention sweep failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const sweepPromise = sweep();
    autoCacheSweepInFlight = sweepPromise;
    try {
        await sweepPromise;
    }
    finally {
        autoCacheSweepInFlight = null;
    }
}
function scheduleAutoCacheSweep(logger) {
    void maybeSweepAutoCaches(logger).catch((error) => {
        logger.warn(`[kv-cache] Failed to schedule auto-cache retention sweep: ${error instanceof Error ? error.message : String(error)}`);
    });
}
/**
 * Drops every auto cache no turn is holding, whatever its age or size.
 *
 * The on-demand counterpart to `maybeSweepAutoCaches`, which applies the
 * standing quota and TTL instead. Reusing the planner keeps the "is this an
 * auto cache" decision in one place: only `.auto-cache-<key>` markers are
 * considered, so caller-owned named caches stay out of scope.
 */
async function deleteInactiveAutoCaches() {
    const cacheKeys = await planAutoCacheEvictions({
        activeCachePaths: snapshotActivePaths(),
        // The quota pass stops at `retainedBytes <= maxBytes`, and a total reaches
        // 0 while zero-byte caches remain (an empty `.bin` from an interrupted save).
        // A negative quota is unreachable, so every inactive entry is selected.
        maxBytes: -1,
        // No age threshold: the quota pass above already selects everything.
        maxIdleMs: 0,
        nowMs: Date.now()
    });
    const evicted = await evictPlannedAutoCaches(cacheKeys);
    if (evicted > 0) {
        moduleLogger.debug(`[kv-cache] Reclaimed ${evicted} inactive auto-cache entries`);
    }
}
// ----- factory -----
/**
 * Construct a session bound to one `(modelId, turn-owning request)`
 * scope. `options.logger` is the per-instance logger the session emits
 * through (typically `withRequestContext(getEngineLogger(), ctx)`);
 * falls back to the module-scoped logger when omitted. `options.discardCache`
 * drops the addon's copy of a conversation whose cache the session rolls
 * back; without it the addon writes that conversation to the deleted path at
 * its next key switch or unload.
 */
export function createKvCacheSession(modelId, options) {
    const logger = options?.logger ?? moduleLogger;
    const discardCache = options?.discardCache;
    // Per-session map: each `TurnHandle` carries an opaque entry here. A
    // WeakMap so handles drop their state once the handler scope releases
    // the reference; the module-scoped maps above survive.
    const turnState = new WeakMap();
    function makeHandle(cachePath, autoCacheKey, releaseWriteLock = () => { }, signal) {
        const handle = {
            cachePath,
            get createdCache() {
                return turnState.get(handle)?.createdByThisTurn ?? false;
            }
        };
        turnState.set(handle, {
            cachePath,
            ...(autoCacheKey !== undefined && { autoCacheKey }),
            ...(signal !== undefined && { signal }),
            releaseWriteLock,
            committed: false,
            rolledBack: false,
            createdByThisTurn: false
        });
        markCachePathActive(cachePath);
        return handle;
    }
    async function beginCustom(input) {
        const cachePath = await getCacheFilePath(modelId, input.configHash, input.customKey);
        // Held for the whole turn so a same-file peer can't interleave writes.
        // Released on commit/rollback/error; throws if aborted while queued.
        let releaseWriteLock;
        try {
            releaseWriteLock = await acquireCachePathWriteLock(cachePath, input.signal);
        }
        catch (error) {
            // Aborted while queued: no lock is held to release, and getCacheFilePath
            // already mkdir'd this key's parent (a distinct dir under a case variant),
            // so prune it before the cancellation propagates.
            if (error instanceof CacheLockAbortError) {
                await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
            }
            throw error;
        }
        // getCacheFilePath already mkdir'd the parent, so prune it before surfacing
        // the cancellation the plugin rides.
        if (input.signal?.aborted) {
            await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
            releaseWriteLock();
            throw new CacheLockAbortError(input.signal.reason);
        }
        // In-memory registry check first — the addon defers disk writes, so a
        // just-saved cache may not yet exist on disk. If the in-memory flag isn't
        // set, fall back to a filesystem probe so caches surviving across process
        // restarts still hit the reuse path.
        let exists = initializedCaches.has(cachePath);
        if (!exists)
            exists = await adoptPersistedCache(cachePath);
        const handle = makeHandle(cachePath, undefined, releaseWriteLock, input.signal);
        try {
            logCacheStatus(input.customKey, exists);
            if (!exists) {
                // Recreate the parent dir if a same-key peer's rollback pruned it after
                // our lock wait, so the addon's own save has somewhere to land.
                await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
                turnState.get(handle).createdByThisTurn = true;
            }
            return handle;
        }
        catch (error) {
            releaseCachePath(cachePath);
            await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
            releaseWriteLock();
            throw error;
        }
    }
    async function beginAuto(input) {
        // The path comes from a history lookup, so: discover it, lock it (outside
        // the state lock, or commitTurn's rename could deadlock a waiter), then
        // re-check existence under the lock in case a same-file peer just renamed it.
        const discovered = await withCacheStateLock(async () => {
            const existingCache = await findMatchingCache(modelId, input.configHash, input.history, input.tools);
            const cacheInfo = existingCache ??
                (await getCurrentCacheInfo(modelId, input.configHash, input.history, input.tools));
            return {
                cachePath: cacheInfo.cachePath,
                cacheKey: cacheInfo.cacheKey
            };
        });
        const { cachePath, cacheKey } = discovered;
        let releaseWriteLock;
        try {
            releaseWriteLock = await acquireCachePathWriteLock(cachePath, input.signal);
        }
        catch (error) {
            // Aborted while queued: no lock is held to release. Discovery already
            // mkdir'd the parent and wrote the auto marker; clean both before the
            // cancellation propagates.
            if (error instanceof CacheLockAbortError) {
                await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
                await removeAutoCacheMarkerIfMissing(cacheKey);
            }
            throw error;
        }
        // Discovery already mkdir'd the parent and wrote the auto marker; clean both
        // before surfacing the cancellation.
        if (input.signal?.aborted) {
            await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
            await removeAutoCacheMarkerIfMissing(cacheKey);
            releaseWriteLock();
            throw new CacheLockAbortError(input.signal.reason);
        }
        let handle;
        let cacheExists;
        try {
            const resolved = await withCacheStateLock(async () => {
                // Mark the path active under the state lock so retention can't evict it.
                const h = makeHandle(cachePath, cacheKey, releaseWriteLock, input.signal);
                let exists = initializedCaches.has(cachePath);
                if (!exists) {
                    try {
                        await fsPromises.access(cachePath);
                        exists = true;
                        initializedCaches.add(cachePath);
                    }
                    catch {
                        exists = false;
                    }
                }
                return { h, exists };
            });
            handle = resolved.h;
            cacheExists = resolved.exists;
        }
        catch (error) {
            releaseWriteLock();
            throw error;
        }
        logCacheStatus('auto', cacheExists);
        try {
            if (!cacheExists) {
                // Recreate the parent dir if a same-file peer's rename pruned it, so
                // the addon's own save has somewhere to land.
                await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
                turnState.get(handle).createdByThisTurn = true;
            }
            return handle;
        }
        catch (error) {
            releaseCachePath(cachePath);
            await pruneEmptyCacheDirectories(cachePath, snapshotActivePaths());
            await removeAutoCacheMarkerIfMissing(cacheKey);
            releaseWriteLock();
            throw error;
        }
    }
    async function beginTurn(input) {
        if (input.kind === 'custom')
            return beginCustom(input);
        return beginAuto(input);
    }
    async function commitTurn(turn, result) {
        const state = turnState.get(turn);
        if (!state) {
            // Handle from a different session or already torn down. Treat as
            // no-op — caller shouldn't be reaching into another session's
            // state, but failing loudly here punishes the rollback-after-end
            // path more than it helps.
            return;
        }
        if (state.committed || state.rolledBack)
            return;
        if (result.kind === 'static') {
            // The addon's save wrote the new cache state at the same path.
            const ok = await verifySaveAndRecord(state.cachePath);
            if (!ok) {
                await runRollback(state);
                return;
            }
            state.committed = true;
            releaseCachePath(state.cachePath);
            state.releaseWriteLock();
            if (state.autoCacheKey !== undefined)
                scheduleAutoCacheSweep(logger);
            return;
        }
        const sourceCachePath = state.cachePath;
        const sourceCacheKey = state.autoCacheKey;
        const targetCacheKey = path.basename(path.dirname(path.dirname(result.targetCachePath)));
        // Hold the target's lock across the rename AND commit verification, so a peer
        // resolving to the same file can't observe it before it is recorded. Abortable: a cancel while waiting for the lock rejects here.
        const releaseTargetLock = await acquireCachePathWriteLock(result.targetCachePath, state.signal);
        try {
            // A cancel that landed while we waited for the target lock must not
            // commit. The file holds what the addon kept, so it stays unless this
            // turn created it.
            if (state.signal?.aborted) {
                await runRelease(state);
                return;
            }
            const renamed = await withCacheStateLock(async () => {
                markCachePathActive(result.targetCachePath);
                try {
                    await fsPromises.mkdir(path.dirname(result.targetCachePath), { recursive: true });
                    await markAutoCacheKey(targetCacheKey);
                    if (!(await renameCacheFile(sourceCachePath, result.targetCachePath))) {
                        releaseCachePath(result.targetCachePath);
                        await pruneEmptyCacheDirectories(result.targetCachePath, snapshotActivePaths());
                        await removeAutoCacheMarkerIfMissing(targetCacheKey);
                        return false;
                    }
                }
                catch (setupError) {
                    // mkdir/markAutoCacheKey/rename threw after the target active-ref was
                    // taken: release it (first, so it can't leak) and prune any directory
                    // or marker created above, then propagate.
                    releaseCachePath(result.targetCachePath);
                    await pruneEmptyCacheDirectories(result.targetCachePath, snapshotActivePaths());
                    await removeAutoCacheMarkerIfMissing(targetCacheKey);
                    throw setupError;
                }
                releaseCachePath(sourceCachePath);
                state.cachePath = result.targetCachePath;
                state.autoCacheKey = targetCacheKey;
                await pruneEmptyCacheDirectories(sourceCachePath, snapshotActivePaths());
                if (sourceCacheKey !== undefined) {
                    await removeAutoCacheMarkerIfMissing(sourceCacheKey);
                }
                // state.cachePath was just reassigned to the target; clear the SOURCE
                // entry, not the freshly-valid target.
                initializedCaches.delete(sourceCachePath);
                return true;
            });
            if (!renamed) {
                logger.warn(`[kv-cache] Auto cache rename failed; rolling back. from=${sourceCachePath} to=${result.targetCachePath}`);
                await runRollback(state);
                return;
            }
            const ok = await verifySaveAndRecord(result.targetCachePath);
            if (!ok) {
                // Rename succeeded but the file isn't where we expected. Roll back via
                // the target path instead of the (now-empty) source.
                await runRollback(state);
                return;
            }
            // Successful auto-rename. The handle's `cachePath` field still points at
            // the (now-gone) source path — fine, the handle is committed and won't
            // roll back. Future turns compute fresh paths.
            state.committed = true;
            releaseCachePath(state.cachePath);
            state.releaseWriteLock();
            scheduleAutoCacheSweep(logger);
        }
        finally {
            releaseTargetLock();
        }
    }
    async function rollback(turn) {
        const state = turnState.get(turn);
        if (!state)
            return;
        if (state.committed || state.rolledBack)
            return;
        await runRollback(state);
    }
    async function releaseTurn(turn) {
        const state = turnState.get(turn);
        if (!state)
            return;
        if (state.committed || state.rolledBack)
            return;
        await runRelease(state);
    }
    async function runRelease(state) {
        // Nothing committed exists to keep, so a failed first turn is destructive.
        if (state.createdByThisTurn) {
            await runRollback(state);
            return;
        }
        releaseCachePath(state.cachePath);
        state.rolledBack = true;
        state.releaseWriteLock();
        if (state.autoCacheKey !== undefined)
            scheduleAutoCacheSweep(logger);
    }
    async function runRollback(state) {
        // Order matters only weakly: unlink first so a partial disk-state
        // can't be re-loaded by a sibling turn between the file delete and
        // the in-memory clear. In practice handlers serialise per model;
        // the order is belt-and-suspenders.
        try {
            await fsPromises.unlink(state.cachePath);
        }
        catch (unlinkError) {
            // A turn that fails before the addon's save has no file to remove, so
            // ENOENT leaves no stale state behind and is not worth a warning.
            if (unlinkError.code !== 'ENOENT') {
                logger.warn(`[kv-cache] Failed to remove cache file during rollback; next turn may load stale KV state. path=${state.cachePath} error=${unlinkError instanceof Error ? unlinkError.message : String(unlinkError)}`);
            }
        }
        if (discardCache) {
            try {
                await discardCache(state.cachePath);
            }
            catch (discardError) {
                logger.warn(`[kv-cache] Failed to discard the addon's copy of a rolled-back cache; a later unload may write it back. path=${state.cachePath} error=${discardError instanceof Error ? discardError.message : String(discardError)}`);
            }
        }
        // Release before pruning so an empty parent can go; a sibling still holding
        // the path keeps it in the active snapshot and protects the directory.
        releaseCachePath(state.cachePath);
        await pruneEmptyCacheDirectories(state.cachePath, snapshotActivePaths());
        if (state.autoCacheKey !== undefined) {
            await removeAutoCacheMarkerIfMissing(state.autoCacheKey);
        }
        initializedCaches.delete(state.cachePath);
        state.rolledBack = true;
        state.releaseWriteLock();
        if (state.autoCacheKey !== undefined)
            scheduleAutoCacheSweep(logger);
    }
    return {
        beginTurn,
        commitTurn,
        rollback,
        releaseTurn
    };
}
// ----- module-level administrative API -----
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
export async function deleteKvCacheState(target) {
    if ('auto' in target)
        return deleteInactiveAutoCaches();
    if ('all' in target) {
        const removed = await deleteCacheUtil({ all: true });
        initializedCaches.clear();
        // `removed` is the kv-cache root dir; surfaces it for ops
        // visibility but isn't part of the contract.
        moduleLogger.debug(`[kv-cache] Cleared all caches under ${removed}`);
        return;
    }
    const removedPath = await deleteCacheUtil({
        kvCacheKey: target.kvCacheKey,
        ...(target.modelId !== undefined && { modelId: target.modelId })
    });
    if (target.modelId === undefined) {
        // Remove the marker by the root-relative key: an alias like "./<16hex>"
        // still resolves to the canonical auto key, while a nested key such as
        // "tenant/<16hex>" stays distinct — path.basename would wrongly collapse it
        // onto the unrelated top-level auto marker.
        await removeAutoCacheMarker(path.relative(getKVCacheDir(), removedPath));
    }
    // The on-disk directory tree is `{kvCacheRoot}/{kvCacheKey}[/{modelId}]/`,
    // so every entry whose path is the removed directory itself or sits beneath
    // it must go.
    clearInitializedCachesByPrefix(removedPath, path.sep);
}
// ----- private helpers -----
/**
 * Verify the cache file exists before recording it as established. The file
 * is the evidence because `saveCache` rejects both when a write fails and when
 * the addon kept nothing to write.
 */
async function verifySaveAndRecord(cachePath) {
    try {
        await fsPromises.access(cachePath);
        initializedCaches.add(cachePath);
        return true;
    }
    catch (err) {
        logCacheSaveError(cachePath, err);
        return false;
    }
}
/**
 * Adopt a `.bin` left by an earlier process run. Returns whether the file
 * exists. Earlier releases kept a `<bin>.meta.json` boundary sidecar beside
 * it; nothing reads one now, so it goes on first contact.
 */
async function adoptPersistedCache(cachePath) {
    try {
        await fsPromises.unlink(`${cachePath}.meta.json`);
    }
    catch {
        // No sidecar for this path.
    }
    try {
        await fsPromises.access(cachePath);
    }
    catch {
        return false;
    }
    initializedCaches.add(cachePath);
    return true;
}
function clearInitializedCachesByPrefix(prefix, sep) {
    if (!prefix) {
        initializedCaches.clear();
        return;
    }
    for (const key of initializedCaches) {
        if (key === prefix || key.startsWith(prefix + sep))
            initializedCaches.delete(key);
    }
}
// ----- test-only escape hatches -----
/**
 * Test-only access to the module-scoped state. Production code reaches
 * for cache state exclusively through the session API; the unit suite
 * for `kv-cache-session.test.ts` needs to seed and inspect raw state
 * to assert the rollback / commit invariants. Not part of the public
 * surface.
 *
 * @internal
 */
export const __kvCacheSessionTestHooks = {
    hasInitializedPath(cachePath) {
        return initializedCaches.has(cachePath);
    },
    getActivePathCountForTest(cachePath) {
        return activeCachePaths.get(cachePath) ?? 0;
    },
    getLastAutoCacheSweepMsForTest() {
        return lastAutoCacheSweepMs;
    },
    setLastAutoCacheSweepMsForTest(value) {
        lastAutoCacheSweepMs = value;
    },
    resetForTest() {
        initializedCaches.clear();
        activeCachePaths.clear();
        lastAutoCacheSweepMs = 0;
        autoCacheSweepInFlight = null;
        cacheStateLockTail = Promise.resolve();
        cachePathLocks.clear();
    },
    waitForAutoCacheSweepForTest() {
        return autoCacheSweepInFlight ?? Promise.resolve();
    },
    sweepAutoCachesForTest(options) {
        return maybeSweepAutoCaches(moduleLogger, { ...options, force: true });
    }
};
// Re-export `generateConfigHash` from the path utilities so callers of
// the session can compute the hash without separately importing
// `kv-cache-utils`. The function itself stays in `kv-cache-utils.ts`
// (pure, no state) — only the re-export lives here.
export { generateConfigHash };
