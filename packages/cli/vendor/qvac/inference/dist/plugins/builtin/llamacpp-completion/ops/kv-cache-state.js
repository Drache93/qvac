/**
 * Pure commit decision for kv-cache turns used by `completion-stream.ts`.
 *
 * This module intentionally has **no** `bare-*` imports so it can be
 * exercised directly from unit tests running under Node without
 * pulling in the Bare runtime (which is not available in that
 * environment).
 */
export function shouldCommitCachedTurn(context) {
    const { aborted, producedTokens, generatedTokens, predict, stoppedAtContextBoundary } = context;
    const stoppedByBudget = predict !== undefined &&
        predict > 0 &&
        generatedTokens !== undefined &&
        generatedTokens >= predict;
    return !aborted && producedTokens && !stoppedByBudget && !stoppedAtContextBoundary;
}
