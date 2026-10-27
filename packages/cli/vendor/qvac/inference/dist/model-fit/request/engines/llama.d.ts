import { type CanonicalModelType } from '../../../schemas/index.js';
import type { FitRequestPlan } from '../create.js';
export type LlamaLoadKind = 'completion' | 'embedding';
export declare function llamaLoadKindFor(modelType: CanonicalModelType): LlamaLoadKind | undefined;
export interface LlamaFitRequestParams {
    loadKind: LlamaLoadKind;
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createLlamaFitRequest(params: LlamaFitRequestParams): FitRequestPlan;
