export function bounds({ gt, gte, lt, lte, reverse, limit }) {
    return {
        gt: gt || undefined,
        gte: gte || undefined,
        lt: lt || undefined,
        lte: lte || undefined,
        reverse: reverse === true,
        limit: limit || undefined
    };
}
