import { send } from '../dispatch.js';
import { decideParamsSchema, decideResponseSchema } from '../schemas/index.js';
import { InvalidResponseError } from '../errors/index.js';
import { decoratePromise } from '../utils/decorate-promise.js';
import { generateRequestId } from '../runtime/request-id.js';
import { parseClientInput } from './parse-input.js';
export function decide(params, options) {
    const requestId = generateRequestId();
    return decoratePromise(runDecide(params, requestId, options), { requestId });
}
async function runDecide(params, requestId, options) {
    const input = parseClientInput(decideParamsSchema, params);
    const response = await send({ ...input, type: 'decide', requestId }, options);
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
