import type { AbortSignal } from 'bare-abort-controller';
/**
 * The abort is persistent state, not a one-shot poke. The addon's `cancel()`
 * only reaches a native job that is live at that instant, and every chunked
 * path (`stream: true`, `sentenceStream`, the duplex session) runs one native
 * job per sentence — so a cancel that lands between two jobs is a native
 * no-op and synthesis would carry on. Ops call this on every chunk: once the
 * signal is aborted it re-issues the cancel (the next job is live by then),
 * and returns true so the caller drops the output instead of forwarding it.
 */
export declare function cancelIfAborted(model: unknown, signal: AbortSignal): Promise<boolean>;
/**
 * Open the request-registry context that makes the model-scoped hard cancel
 * both TTS handlers advertise actually work, and bind its abort signal to the
 * addon's `cancel()`.
 *
 * `cancel: { scope: 'model', hard: true }` is a claim the runtime does not
 * enforce on its own: `cancelByModelId` walks the request registry, so a run
 * that never opened a context is invisible to it — a caller's `cancel()` would
 * resolve with `cancelled: 0` while the native job ran to completion. Same
 * shape as the transcription and audiogen ops.
 *
 * The returned context is an async disposable: callers must take it with
 * `await using`, and must bail out when `ctx.signal.aborted` is already true on
 * return — a queued request can resume from `begin()` already aborted, and it
 * never owned the model slot, so cancelling then would interrupt the run that
 * does.
 */
export declare function bindTtsCancel(model: unknown, modelId: string, requestId?: string): Promise<import("../../../../runtime/index.js").ManagedRequestContext>;
