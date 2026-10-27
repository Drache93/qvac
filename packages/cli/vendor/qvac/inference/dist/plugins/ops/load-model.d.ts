import type { AbortSignal } from 'bare-abort-controller';
import { type LoadModelServerParams } from '../../schemas/index.js';
import type { LoadTimingStats } from '../../profiling/types.js';
export interface LoadModelResult {
    timing?: LoadTimingStats;
}
export interface LoadModelOptions {
    collectTiming?: boolean;
    request?: {
        signal: AbortSignal;
        requestId: string;
    };
}
export declare function loadModel(params: LoadModelServerParams, options?: LoadModelOptions): Promise<LoadModelResult>;
