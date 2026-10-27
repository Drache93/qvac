import type { FitRequestPlan } from '../create.js';
export interface DiffusionFitRequestParams {
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
}
export declare function createDiffusionFitRequest(params: DiffusionFitRequestParams): FitRequestPlan;
