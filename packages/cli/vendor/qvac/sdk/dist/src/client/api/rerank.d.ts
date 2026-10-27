import { send } from '../rpc/rpc-client.js';
import { type RerankParams, type RerankScores, type RPCOptions } from '@qvac/inference/surface';
/**
 * Scores documents by relevance to a query with a reranker model.
 *
 * @param params - Model ID, query, and the documents to score.
 * @param options - RPC transport options.
 * @returns A promise with a synchronous requestId for cancel(). Resolves to
 * one score per document, in input order; higher is more relevant. Scores are
 * the model's raw output, so compare them within one model only.
 * @throws {RequestValidationFailedError} If the request is invalid.
 * @throws {InferenceCancelledError} If the request is cancelled.
 * @throws {RequestRejectedByPolicyError} If this model's rerank queue is full.
 * @throws {InvalidResponseError} If the worker returns a malformed result.
 */
export declare function rerank(params: RerankParams, options?: RPCOptions): Promise<RerankScores> & {
    requestId: string;
};
export declare function createRerankCall(params: RerankParams, options?: RPCOptions, sendRequest?: typeof send): Promise<RerankScores> & {
    requestId: string;
};
//# sourceMappingURL=rerank.d.ts.map