const RUNGS = [262_144, 131_072, 65_536];
const CEILINGS = {
    mid: 65_536,
    high: 131_072,
    xhigh: 262_144
};
export class ContextChoice {
    _profile;
    _pending = new Map();
    _chosen = new Map();
    constructor(profile) {
        this._profile = profile;
    }
    static ceiling(profile) {
        return profile && CEILINGS[profile];
    }
    chosen(key) {
        return this._chosen.get(key);
    }
    choose(key, tier, ask) {
        const pending = this._pending.get(key);
        if (pending) {
            return pending;
        }
        const choice = this._climb(tier, ask).then((ctxSize) => {
            if (ctxSize === undefined) {
                this._pending.delete(key);
                return tier;
            }
            this._chosen.set(key, ctxSize);
            return ctxSize;
        });
        this._pending.set(key, choice);
        return choice;
    }
    async _climb(tier, ask) {
        const ceiling = ContextChoice.ceiling(await this._profile());
        if (!ceiling || ceiling <= tier) {
            return tier;
        }
        const trained = await ask.trained();
        if (!trained) {
            return undefined;
        }
        for (const rung of RUNGS) {
            if (rung > ceiling || rung > trained || rung <= tier) {
                continue;
            }
            if (await ask.fits(rung)) {
                return rung;
            }
        }
        return tier;
    }
}
