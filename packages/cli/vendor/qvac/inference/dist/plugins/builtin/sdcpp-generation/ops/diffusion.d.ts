import type { DiffusionRequest, DiffusionStreamResponse, DiffusionStats } from '../../../../schemas/sdcpp-config.js';
export type DiffusionOpResult = {
    stats: DiffusionStats | undefined;
};
export declare function diffusion(request: DiffusionRequest): AsyncGenerator<DiffusionStreamResponse, DiffusionOpResult>;
