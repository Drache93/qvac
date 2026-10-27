import { type LoadDescription } from './resolve-load.js';
import type { FitStubOptions, FitStubUnavailableReason } from './fetch.js';
import { type AdvisoryFitOptions, type AdvisoryFitOutcome } from '../load-check.js';
export type LoadFitOutcome = {
    status: 'projected';
    fit: AdvisoryFitOutcome;
} | {
    status: 'no-stub';
    reason: FitStubUnavailableReason;
    message?: string;
} | {
    status: 'unsupported-load';
    detail: string;
};
export interface LoadFitOptions {
    stub?: FitStubOptions;
    fit?: AdvisoryFitOptions;
}
/**
 * Projects the load a caller describes, before its weights exist locally.
 *
 * The same probe `loadModel` runs, over the same config and artifacts that
 * load's own plugin resolves, pointed at files that are tens of KB instead of
 * gigabytes. It inherits the probe's fail-open contract: every failure is an
 * `unknown` verdict or a non-projected outcome, never a throw.
 */
export declare function projectFitFromLoad(load: LoadDescription, modelId: string, options?: LoadFitOptions): Promise<LoadFitOutcome>;
