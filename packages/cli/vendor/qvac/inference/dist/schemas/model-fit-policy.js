import { z } from 'zod';
/**
 * What the engine fitter's verdict does to a load. Only `does-not-fit` blocks
 * under `refuse`: `unknown` is what an engine with no fitter, an unresolved
 * companion set and a host reporting no memory all answer.
 */
export const modelFitPolicySchema = z.enum(['log', 'refuse', 'off']);
export const DEFAULT_MODEL_FIT_POLICY = 'log';
export function resolveModelFitPolicy(perCall, configured) {
    return perCall ?? configured ?? DEFAULT_MODEL_FIT_POLICY;
}
export function runsProbe(policy) {
    return policy !== 'off';
}
export function refusesLoad(policy, verdict) {
    return policy === 'refuse' && verdict === 'does-not-fit';
}
