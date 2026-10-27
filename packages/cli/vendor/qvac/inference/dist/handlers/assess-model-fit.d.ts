import type { AssessModelFitRequest, AssessModelFitResponse, ModelFitCandidate, ModelFitEstimateTarget } from '../schemas/assess-model-fit.js';
import type { FitStubUnavailableReason } from '../model-fit/description/fetch.js';
/**
 * Runs a pre-download fit assessment worker-side.
 *
 * This lives on the worker because that is where the three things it needs
 * already are: the resource collector for a fresh memory sample, the runtime's
 * own platform/arch pair, and the registry client. No weights are read and
 * nothing is loaded — each candidate additionally has the registry's weightless
 * description fetched, tens of KB, so the engine's own fitter can answer.
 */
export declare function handleAssessModelFit(request: AssessModelFitRequest): Promise<AssessModelFitResponse>;
/**
 * What the estimator is given for one candidate. The catalog facts come from
 * the source's checksum, and the workload from the settings the load carries;
 * a source outside the catalog resolves neither and assesses as `unknown`.
 *
 * A load whose sources are all config fields carries no checksum, so it has no
 * catalog profile and the engine's own fitter is its only evidence. The model
 * type stands in as the label.
 */
export declare function estimateTargetFor(candidate: ModelFitCandidate): ModelFitEstimateTarget;
/** Why a load with no description staged for it has no engine verdict. */
export declare function noStubDetail(reason: FitStubUnavailableReason, message?: string): string;
