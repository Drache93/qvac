import type { FitRequestPlan } from '../create.js';
export interface OcrFitRequestParams {
    /** The recognizer, which is the load's primary model. */
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createOcrFitRequest(params: OcrFitRequestParams): FitRequestPlan;
