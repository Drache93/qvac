import { parseClientInput } from '../parse-input.js';
import { send } from '../rpc/rpc-client.js';
import { rerankParamsSchema, rerankResponseSchema } from '@qvac/inference/surface';
import { InvalidResponseError } from '../../utils/errors-client.js';
import { decoratePromise } from '../../utils/decorate-promise.js';
import { generateClientRequestId } from './client-request-id.js';
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
export function rerank(params, options) {
    return createRerankCall(params, options);
}
export function createRerankCall(params, options, sendRequest = send) {
    const requestId = generateClientRequestId();
    return decoratePromise(runRerank(params, requestId, options, sendRequest), { requestId });
}
async function runRerank(params, requestId, options, sendRequest) {
    const input = parseClientInput(rerankParamsSchema, params);
    const response = await sendRequest({ ...input, type: 'rerank', requestId }, options);
    if (response.type !== 'rerank')
        throw new InvalidResponseError('rerank');
    const parsed = rerankResponseSchema.safeParse(response);
    if (!parsed.success)
        throw new InvalidResponseError('rerank', parsed.error);
    const { scores } = parsed.data;
    if (scores.length !== input.documents.length)
        throw new InvalidResponseError('rerank');
    return scores;
}
