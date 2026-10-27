import {} from '@qvac/inference/surface';
import { send } from '../rpc/rpc-client.js';
import { InvalidResponseError } from '../../utils/errors-client.js';
/**
 * Read the worker's system capabilities and optional resource sample.
 *
 * @param input - Optional settings; set `sample` to request a current resource sample.
 * @returns System capabilities with availability information and a sample when provided by the worker.
 * @throws {InvalidResponseError} If the worker returns a different response type.
 * @throws {Error} If the RPC request fails.
 */
export async function getSystemResources(input) {
    const request = {
        type: 'getSystemResources',
        ...(input?.sample !== undefined && { sample: input.sample })
    };
    const response = await send(request);
    if (response.type !== 'getSystemResources') {
        throw new InvalidResponseError('getSystemResources');
    }
    return {
        capabilities: response.capabilities,
        ...(response.sample && { sample: response.sample })
    };
}
