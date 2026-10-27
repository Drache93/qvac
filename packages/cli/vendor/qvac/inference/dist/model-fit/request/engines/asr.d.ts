import type { TranscriptionFitWorkload } from '../../../schemas/index.js';
import type { FitRequestPlan } from '../create.js';
export interface AsrFitRequestParams {
    modelPath: string;
    modelConfig: unknown;
    artifacts?: Record<string, string> | undefined;
    marginBytes?: number | undefined;
}
export declare function createMossTranscribeFitRequest(params: AsrFitRequestParams & {
    transcriptionWorkload?: TranscriptionFitWorkload | undefined;
}): FitRequestPlan;
export declare function createWhisperFitRequest(params: AsrFitRequestParams): FitRequestPlan;
export declare function createParakeetFitRequest(params: AsrFitRequestParams): FitRequestPlan;
export declare function createBciFitRequest(params: AsrFitRequestParams): FitRequestPlan;
