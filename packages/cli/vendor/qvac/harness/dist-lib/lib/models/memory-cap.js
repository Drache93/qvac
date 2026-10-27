export const VictimRank = {
    generator: 0,
    companion: 1,
    requested: 2,
    pinned: 3,
    replying: 4
};
export function nextVictim(victims) {
    let best;
    for (const victim of victims) {
        if (best === undefined ||
            victim.rank < best.rank ||
            (victim.rank === best.rank && victim.lastUsed < best.lastUsed)) {
            best = victim;
        }
    }
    return best;
}
export function memoryCapBytes(percent, availableBytes) {
    return Math.round((Math.min(percent, 100) / 100) * availableBytes);
}
