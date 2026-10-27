import { parseClientInput } from '../parse-input.js';
import { send } from '../rpc/rpc-client.js';
import { decideParamsSchema, decideResponseSchema } from '@qvac/inference/surface';
import { InvalidResponseError } from '../../utils/errors-client.js';
import { decoratePromise } from '../../utils/decorate-promise.js';
import { generateClientRequestId } from './client-request-id.js';
export function decide(params, options) {
    return createDecisionCall(params, options);
}
export function createDecisionCall(params, options, sendRequest = send) {
    const requestId = generateClientRequestId();
    return decoratePromise(runDecide(params, requestId, options, sendRequest), { requestId });
}
async function runDecide(params, requestId, options, sendRequest) {
    const input = parseClientInput(decideParamsSchema, params);
    const response = await sendRequest({ ...input, type: 'decide', requestId }, options);
    if (response.type !== 'decide')
        throw new InvalidResponseError('decide');
    const parsed = decideResponseSchema.safeParse(response);
    if (!parsed.success)
        throw new InvalidResponseError('decide', parsed.error);
    const { result } = parsed.data;
    if ('states' in input
        ? !Array.isArray(result) || result.length !== input.states.length
        : Array.isArray(result)) {
        throw new InvalidResponseError('decide');
    }
    return result;
}
