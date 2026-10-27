import { type RerankRequest } from '../../../../schemas/index.js';
export declare function rerank(request: RerankRequest): Promise<{
    type: "rerank";
    scores: number[];
}>;
