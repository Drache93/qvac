/**
 * Pure commit decision for kv-cache turns used by `completion-stream.ts`.
 *
 * This module intentionally has **no** `bare-*` imports so it can be
 * exercised directly from unit tests running under Node without
 * pulling in the Bare runtime (which is not available in that
 * environment).
 */
interface CacheCommitContext {
    aborted: boolean;
    producedTokens: boolean;
    generatedTokens?: number | undefined;
    predict?: number | undefined;
    stoppedAtContextBoundary: boolean;
}
export declare function shouldCommitCachedTurn(context: CacheCommitContext): boolean;
export {};
