import { send } from '../dispatch.js';
import { rerankParamsSchema, rerankResponseSchema } from '../schemas/index.js';
import { InvalidResponseError } from '../errors/index.js';
import { decoratePromise } from '../utils/decorate-promise.js';
import { generateRequestId } from '../runtime/request-id.js';
import { parseClientInput } from './parse-input.js';
/**
 * Scores documents by relevance to a query with a reranker model.
 *
 * @param params - Model ID, query, and the documents to score.
 * @param options - Dispatch options.
 * @returns A promise with a synchronous requestId for cancel(). Resolves to
 * one score per document, in input order; higher is more relevant. Scores are
 * the model's raw output, so compare them within one model only.
 * @throws {RequestValidationFailedError} If the request is invalid.
 * @throws {InferenceCancelledError} If the request is cancelled.
 * @throws {RequestRejectedByPolicyError} If this model's rerank queue is full.
 * @throws {InvalidResponseError} If the handler returns a malformed result.
 */
export function rerank(params, options) {
    const requestId = generateRequestId();
    return decoratePromise(runRerank(params, requestId, options), { requestId });
}
async function runRerank(params, requestId, options) {
    const input = parseClientInput(rerankParamsSchema, params);
    const response = await send({ ...input, type: 'rerank', requestId }, options);
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
