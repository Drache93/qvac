import { MAX_BLOCKED_REPEATS, MAX_CAPPED_ROUNDS, MAX_CUT_ROUNDS, MAX_MUTE_ROUNDS, MAX_UNCHANGED_RESULTS } from '../rules.js';
export function canMuteRetry(ctx) {
    return ctx.mute < MAX_MUTE_ROUNDS && hasRoundsLeft(ctx);
}
export function canRetryCut(ctx) {
    return ctx.cuts + 1 < MAX_CUT_ROUNDS && hasRoundsLeft(ctx);
}
export function canRetrySearchCap(ctx) {
    return ctx.cappedRounds < MAX_CAPPED_ROUNDS;
}
export function repeatsBlocked(ctx) {
    return (!ctx.roundProgressed && ctx.blockedRepeats >= MAX_BLOCKED_REPEATS) || resultStuck(ctx);
}
function resultStuck(ctx) {
    return Object.values(ctx.settledResults).some(({ repeats, round }) => round === ctx.round && repeats >= MAX_UNCHANGED_RESULTS);
}
export function hasRoundsLeft(ctx) {
    return ctx.round + 1 < ctx.policy.maxToolRounds;
}
export function canRetryNarrated(ctx) {
    return !ctx.narrated && hasRoundsLeft(ctx);
}
export function canRetryMalformed(ctx) {
    return !ctx.malformed && hasRoundsLeft(ctx);
}
export function hasQueuedTool(ctx) {
    return ctx.toolQueue.length > 0;
}
export function allResolvedToolsCapped(ctx) {
    return ctx.resolvedCount > 0 && ctx.cappedCalls === ctx.resolvedCount;
}
export function searchPending(ctx) {
    return Boolean(ctx.pendingSearch);
}
