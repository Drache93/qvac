import { send } from '../dispatch.js';
import { InvalidResponseError } from '../errors/index.js';
import { decoratePromise } from '../utils/decorate-promise.js';
import { generateRequestId } from '../runtime/request-id.js';
/**
 * Start a worker-owned native RPC server. Non-loopback binding and advertising require explicit opt-in.
 * Cancel a pending start with its promise.requestId.
 */
export function startRpcServer(options = {}) {
    const requestId = generateRequestId();
    return decoratePromise(runStartRpcServer(options, requestId), { requestId });
}
async function runStartRpcServer(options, requestId) {
    const response = await send({ ...options, type: 'startRpcServer', requestId });
    if (response.type !== 'startRpcServer')
        throw new InvalidResponseError('startRpcServer');
    return {
        serverId: response.serverId,
        url: response.url,
        rdmaCapable: response.rdmaCapable
    };
}
/** Withdraw the announcement and await native stop. Bare stop has no deadline. */
export async function stopRpcServer(options) {
    const response = await send({ ...options, type: 'stopRpcServer' });
    if (response.type !== 'stopRpcServer')
        throw new InvalidResponseError('stopRpcServer');
}
/**
 * Find private-network candidates with device inventories and server RDMA availability.
 * RDMA availability is a server-side offer, not a guarantee of the negotiated transport.
 * Use getRpcDeviceMap with the chosen endpoint registration order before loadModel.
 * Cancel a pending search with its promise.requestId.
 */
export function discoverRpcServers(options) {
    const requestId = generateRequestId();
    return decoratePromise(runDiscoverRpcServers(options, requestId), { requestId });
}
async function runDiscoverRpcServers(options, requestId) {
    const response = await send({ ...options, type: 'discoverRpcServers', requestId });
    if (response.type !== 'discoverRpcServers')
        throw new InvalidResponseError('discoverRpcServers');
    return response.servers;
}
