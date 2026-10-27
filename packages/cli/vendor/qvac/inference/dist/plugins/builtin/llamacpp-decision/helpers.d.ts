import type { LayaConfig, LayaRequest as NativeLayaRequest, LayaResult as NativeLayaResult } from '@qvac/embed-llamacpp';
import type { DecisionConfig, DecisionRequest, DecisionResult } from '../../../schemas/index.js';
export declare function transformDecisionConfig(config: DecisionConfig): LayaConfig;
export declare function transformDecisionRequest(request: DecisionRequest): NativeLayaRequest;
export declare function transformDecisionResult(result: NativeLayaResult): DecisionResult;
