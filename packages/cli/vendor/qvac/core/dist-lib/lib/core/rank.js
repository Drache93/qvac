const FLOOR = 1;
export const STEP = 1_000;
const TOP_STEP = 1;
export function rankBetween(anchor, next) {
    if (next === undefined) {
        return Math.max(anchor - STEP, FLOOR);
    }
    return anchor + (next - anchor) / 2;
}
export function rankOnTop(top, now) {
    return top === undefined ? now : Math.max(top + TOP_STEP, now);
}
export function place(siblings, keyOf, { at, now }) {
    const upper = at >= 0 ? keyOf(siblings[at]) : undefined;
    const below = siblings[at + 1];
    const lower = below === undefined ? undefined : keyOf(below);
    const rank = upper === undefined ? rankOnTop(lower, now) : rankBetween(upper, lower);
    if ((upper === undefined || rank < upper) && (lower === undefined || rank > lower)) {
        return { rank, respaced: [] };
    }
    const top = Math.max(now, keyOf(siblings[0]));
    const respaced = siblings.map((row, i) => ({ row, rank: top - (i > at ? i + 1 : i) * STEP }));
    return { rank: top - (at + 1) * STEP, respaced };
}
