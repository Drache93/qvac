import type { AssessModelFitResult, ModelFitBasis, ModelFitEstimateTarget, ModelFitExecution, NativeProbeFit } from '../schemas/assess-model-fit.js';
import type { SystemResources } from '../schemas/system-resources.js';
import type { ModelResourceProfile } from '../schemas/model-resource-profile.js';
import type { ModelFitPlatform } from './platform.js';
/** Resolves a checksum to its catalog resource profile. */
export type ProfileResolver = (sha256Checksum: string) => ModelResourceProfile | undefined;
export interface AssessModelFitOptions {
    models: readonly ModelFitEstimateTarget[];
    execution: ModelFitExecution;
    resources: SystemResources;
    /**
     * `undefined` when the runtime's platform/arch pair is not one this
     * assessment covers. Also selects the mobile headroom policy.
     */
    platform: ModelFitPlatform | undefined;
    /** Defaults to the generated catalog table; injected in tests. */
    resolveProfile?: ProfileResolver;
    /**
     * The engine's own verdict per candidate, in `models` order, from the
     * registry's fit stubs. Resolved in the handler, which is where the network
     * is. A candidate whose fitter reached no verdict falls back to the evidence
     * the rest of this assessment can give it.
     */
    nativeFits?: readonly NativeCandidateFit[] | undefined;
}
/** One candidate's engine verdict, or why it has none. */
export interface NativeCandidateFit {
    fit?: NativeProbeFit | undefined;
    unavailable?: string | undefined;
}
/**
 * Turns catalog profiles plus a fresh system-memory sample into an advisory
 * verdict.
 *
 * Pure: every input is passed in, so the same call is testable without a worker,
 * a device, or a network. Sampling, platform detection and the engine fitter
 * calls happen in the handler.
 */
export declare function assessModelFitFromResources(options: AssessModelFitOptions): AssessModelFitResult;
/**
 * Whether every allocation a load makes comes out of the memory the system (or
 * process) budget measures — the precondition for the computed floor to be
 * compared against that budget.
 *
 * True on unified-memory platforms whatever the collector reports, and
 * elsewhere when no usable GPU is present or every usable GPU allocates out of
 * system RAM. A card with its own memory, or a device whose class cannot be
 * told (an AMD APU on linux), fails it: the weights may live where the budget
 * cannot see them.
 */
export declare function boundBySystemMemory(resources: SystemResources, platform: ModelFitPlatform | undefined): boolean;
/**
 * Picks the budget basis for a platform.
 *
 * iOS is the exception: jetsam terminates an app on its own footprint against
 * a per-process limit well below device RAM, so a system-memory budget there
 * would defend `likely-fits` verdicts the OS does not honor. Android's
 * low-memory killer acts system-wide and native allocations carry no
 * per-process cap, so it deliberately keeps the system basis with the mobile
 * reserve.
 */
export declare function resolveBasis(platform: ModelFitPlatform | undefined): ModelFitBasis;
/**
 * Derives the memory budget from the sample, under the platform's basis.
 *
 * Only `sample.memory` is used: capabilities-only totals say nothing about what
 * is free right now, and a verdict without that is not worth giving. Under the
 * process basis the ceiling is reconstructed as allowance + footprint — the
 * relation the OS enforces — so every budget field keeps the same meaning
 * under either basis.
 */
export declare function resolveBudget(resources: SystemResources, platform: ModelFitPlatform | undefined, basis: ModelFitBasis, reasons: string[]): AssessModelFitResult['budget'];
