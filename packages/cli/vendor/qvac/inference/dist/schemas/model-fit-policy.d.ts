import { z } from 'zod';
import type { NativeProbeVerdict } from './assess-model-fit.js';
/**
 * What the engine fitter's verdict does to a load. Only `does-not-fit` blocks
 * under `refuse`: `unknown` is what an engine with no fitter, an unresolved
 * companion set and a host reporting no memory all answer.
 */
export declare const modelFitPolicySchema: z.ZodEnum<{
    off: "off";
    log: "log";
    refuse: "refuse";
}>;
export type ModelFitPolicy = z.infer<typeof modelFitPolicySchema>;
export declare const DEFAULT_MODEL_FIT_POLICY: ModelFitPolicy;
export declare function resolveModelFitPolicy(perCall: ModelFitPolicy | undefined, configured: ModelFitPolicy | undefined): ModelFitPolicy;
export declare function runsProbe(policy: ModelFitPolicy): boolean;
export declare function refusesLoad(policy: ModelFitPolicy, verdict: NativeProbeVerdict | undefined): boolean;
