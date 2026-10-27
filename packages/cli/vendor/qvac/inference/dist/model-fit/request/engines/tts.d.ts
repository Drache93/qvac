import type { TtsFitWorkload } from '../../../schemas/assess-model-fit.js';
import type { FitRequestPlan } from '../create.js';
export interface TtsFitRequestParams {
    ttsWorkload?: TtsFitWorkload | undefined;
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createTtsFitRequest(params: TtsFitRequestParams): FitRequestPlan;
