import type { FitRequestPlan } from '../create.js';
export interface NmtFitRequestParams {
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createNmtFitRequest(params: NmtFitRequestParams): FitRequestPlan;
