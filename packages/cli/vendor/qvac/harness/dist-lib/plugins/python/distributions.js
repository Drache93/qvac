import { MODULE_DISTRIBUTIONS } from './module-distributions.js';
export function moduleDistribution(module) {
    return Object.hasOwn(MODULE_DISTRIBUTIONS, module) ? (MODULE_DISTRIBUTIONS[module] ?? null) : null;
}
