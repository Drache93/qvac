import type { FitRequestPlan } from '../create.js';
export interface AudiogenFitRequestParams {
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createAudiogenFitRequest(params: AudiogenFitRequestParams): FitRequestPlan;
