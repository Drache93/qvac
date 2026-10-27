import type { AbortSignal } from 'bare-abort-controller';
import type { Logger } from '../logging/types.js';
import type { TtsFitWorkload } from '../schemas/assess-model-fit.js';
import type { CanonicalModelType, NativeProbeFit, NativeProbeVerdict, TranscriptionFitWorkload } from '../schemas/index.js';
import { runFit as runFitDefault } from './run/run.js';
/**
 * `fit` and `does-not-fit` are projections of the load the SDK is about to run.
 * The real loader neither consumes nor verifies the fitted plan.
 *
 * The outcome is the wire shape: `loadModel` hands it to the model registry and
 * `getLoadedModelInfo` returns it, so no caller has to read a verdict out of a
 * log line.
 */
export type AdvisoryFitVerdict = NativeProbeVerdict;
export type AdvisoryFitOutcome = NativeProbeFit;
export interface AdvisoryFitInput {
    transcriptionWorkload?: TranscriptionFitWorkload | undefined;
    ttsWorkload?: TtsFitWorkload | undefined;
    modelId: string;
    modelType: CanonicalModelType;
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    isShardedModel: boolean;
}
/**
 * Injection seams. Every field defaults to the real runtime dependency; tests
 * substitute them rather than mocking modules.
 */
export interface AdvisoryFitOptions {
    signal?: AbortSignal;
    runFit?: typeof runFitDefault;
    logger?: Logger;
    availableSystemBytes?: () => Promise<number | undefined>;
    countsDeviceRows?: () => Promise<boolean>;
    residentModelBytes?: () => Promise<number>;
    /**
     * Bytes to hold back beyond what is resident, for models the caller counts
     * as loaded alongside this one but that this worker does not yet hold.
     */
    extraResidentBytes?: number;
}
/**
 * Runs the advisory fit check for a load that is about to start, against the
 * fitter belonging to the engine that will run it.
 *
 * Fail-open by construction: an unsupported shape, a fitter that crashed,
 * threw or did not return in time, and an unexpected internal error all
 * resolve to `unknown` and the caller proceeds with the ordinary load path.
 * This function never throws and never rejects.
 */
export declare function runAdvisoryFitCheck(input: AdvisoryFitInput, options?: AdvisoryFitOptions): Promise<AdvisoryFitOutcome>;
