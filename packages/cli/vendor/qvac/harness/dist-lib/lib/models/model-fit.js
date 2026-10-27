import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
const CONTEXT_RUNGS = [32_768, 16_384, 8_192];
export class ModelFit {
    _assess;
    _chosen = new Map();
    _rows = null;
    constructor(assess) {
        this._assess = assess;
    }
    static query(asset, contextTokens, { native = false, modelType } = {}) {
        const { src, sha256Checksum, name, registryPath, registrySource } = asset;
        return native
            ? { src, sha256Checksum, name, registryPath, registrySource, modelType, contextTokens }
            : { src, sha256Checksum, name, modelType, contextTokens };
    }
    static confirms(assessed) {
        return assessed?.verdict === 'likely-fits' && assessed.evidence === 'native-fit';
    }
    async assess(query) {
        const [assessed] = await this._ask([query]);
        return assessed;
    }
    rows(queries) {
        if (this._rows) {
            return this._rows;
        }
        const keyed = [...queries()];
        const pending = this._ask(keyed.map(([, query]) => query)).then((assessed) => new Map(keyed.map(([key], i) => [key, assessed[i]])));
        this._rows = pending;
        pending.catch(() => {
            if (this._rows === pending) {
                this._rows = null;
            }
        });
        return pending;
    }
    clearRows() {
        this._rows = null;
    }
    chosen(key) {
        return this._chosen.get(key)?.ctxSize;
    }
    chosenSlots(key) {
        return this._chosen.get(key)?.slots;
    }
    keep(key, { ctxSize, slots }) {
        if (!this._chosen.has(key)) {
            this._chosen.set(key, { ctxSize, slots });
        }
    }
    async ladder(asset, tier, slots = 1) {
        const choice = await this._steps(asset, tier, { slots, native: true });
        if (choice.fits || slots === 1) {
            return choice;
        }
        return this._steps(asset, tier, { slots: 1, native: false });
    }
    async _steps(asset, tier, { slots, native }) {
        const top = await this.settle(ModelFit.query(asset, tier * slots, { native }));
        if (top?.verdict !== 'likely-too-large') {
            return { ctxSize: tier, slots, fits: true };
        }
        for (const rung of CONTEXT_RUNGS.filter((size) => size < tier)) {
            const assessed = await this.settle(ModelFit.query(asset, rung * slots));
            if (ModelFit.confirms(assessed)) {
                return { ctxSize: rung, slots, fits: true };
            }
            if (assessed?.verdict !== 'likely-too-large') {
                break;
            }
        }
        return { ctxSize: tier, slots, fits: false };
    }
    async _ask(queries) {
        const result = await this._assess({
            models: queries.map(({ contextTokens, modelType = 'llm', sha256Checksum, ...source }) => ({
                modelSrc: sha256Checksum ? { ...source, sha256Checksum } : source.src,
                modelType,
                modelConfig: { ctx_size: contextTokens }
            })),
            execution: 'sequential',
            policy: 'interactive-v1'
        });
        return queries.map((_, i) => {
            const model = result.models[i];
            return {
                verdict: model?.verdict ?? result.verdict,
                basis: result.basis,
                evidence: model ? model.evidence : result.evidence,
                reasons: [...(model?.reasons ?? result.reasons)]
            };
        });
    }
    settle(query) {
        return this.assess(query).catch((err) => {
            HarnessLog.warn('fit estimate failed', { model: query.name, err: errorMessage(err) });
            return null;
        });
    }
}
