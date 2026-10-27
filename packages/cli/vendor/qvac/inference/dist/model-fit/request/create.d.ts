import type { TtsFitWorkload } from '../../schemas/assess-model-fit.js';
import { type CanonicalModelType, type TranscriptionFitWorkload } from '../../schemas/index.js';
import type { FitProbeRequest } from '../run/engine.js';
export type FitRequestPlan = {
    supported: true;
    probe: FitProbeRequest;
} | {
    supported: false;
    detail: string;
};
export interface CreateFitRequestParams {
    ttsWorkload?: TtsFitWorkload | undefined;
    modelType: CanonicalModelType;
    modelPath: string;
    modelConfig: unknown;
    transcriptionWorkload?: TranscriptionFitWorkload | undefined;
    artifacts?: Record<string, string> | undefined;
    isShardedModel: boolean;
    /** Free memory that must remain for the projection to count as fitting. */
    marginBytes?: number | undefined;
}
/**
 * Builds a fit request from the same resolved config and artifacts the real
 * load is about to use, or explains why this load cannot be answered for.
 *
 * Structural shapes the SDK owns — a load with no fitter behind it, a companion
 * set that did not resolve, a setting whose effect on the projection is unknown
 * — are refused here so no engine is asked a question it cannot answer.
 * Value-level policy stays inside each engine's own fitter.
 */
export declare function createFitRequest(params: CreateFitRequestParams): FitRequestPlan;
