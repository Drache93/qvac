export function keyRange(prefix, field, { gt, gte, lt, lte, reverse, limit } = {}) {
    const at = (value) => ({ ...prefix, [field]: value });
    const range = { reverse: reverse === true, limit: limit || undefined };
    if (gt !== undefined) {
        range.gt = at(gt);
    }
    if (gte !== undefined) {
        range.gte = at(gte);
    }
    if (lt !== undefined) {
        range.lt = at(lt);
    }
    if (lte !== undefined) {
        range.lte = at(lte);
    }
    if (range.gt === undefined && range.gte === undefined) {
        range.gte = { ...prefix };
    }
    if (range.lt === undefined && range.lte === undefined) {
        range.lte = { ...prefix };
    }
    return range;
}
