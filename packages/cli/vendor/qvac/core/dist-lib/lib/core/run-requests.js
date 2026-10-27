import b4a from 'b4a';
import { isMobilePlatform } from '@qvac/harness/lib/models/model-catalog.ts';
import { CAPABILITY_PROFILES } from '../../schema/qvac.js';
import { CoreError } from '../errors.js';
import { getChunk, mustGetChunk } from './chunk.js';
import { openToTake, runHasTerminalStatus, runTaker } from './contract/run-requests.js';
import { DEVICES, RUN_REQUESTS } from './collections.js';
const rank = (device) => CAPABILITY_PROFILES.indexOf(device.capabilityProfile);
export async function pickRunner(mesh, { deviceId, peers, agent }) {
    const self = await mesh.view.get(DEVICES, { id: deviceId });
    const member = self?.memberId;
    if (!member) {
        return undefined;
    }
    const connected = new Set(peers);
    const devices = await mesh.view.find(DEVICES).toArray();
    const ours = devices.filter((device) => !device.revoked &&
        !!device.memberId &&
        b4a.equals(device.memberId, member) &&
        !b4a.equals(device.id, deviceId) &&
        connected.has(b4a.toHex(device.id)));
    const provider = ours.find((device) => b4a.equals(device.id, agent.providerDeviceId));
    if (provider) {
        return provider.id;
    }
    const desktops = ours.filter((device) => !isMobilePlatform(device.platform ?? ''));
    return desktops.sort((a, b) => rank(b) - rank(a))[0]?.id;
}
export async function takeRunRequest(store, id) {
    const request = await getChunk(store, id);
    if (request?.type !== 'run-request') {
        throw new CoreError('CHUNK_NOT_FOUND', [id]);
    }
    if (request.runnerDeviceId && !(await runTaker(store.view, request, store.localWriterKey))) {
        throw new CoreError('RUN_REQUEST_NOT_OURS', [id]);
    }
    const { chatId, runId } = request;
    if (!openToTake(request) || !runId || (await runHasTerminalStatus(store.view, chatId, runId))) {
        throw new CoreError('RUN_REQUEST_TAKEN', [id]);
    }
    await store.dispatch('take-run-request', { id, at: Date.now() });
    return mustGetChunk(store, id);
}
export async function handedOffRequests(store, deviceId, chatId) {
    const range = { gte: { chatId }, lte: { chatId } };
    const handed = [];
    for await (const request of store.view.find(RUN_REQUESTS, range)) {
        const ours = openToTake(request) && b4a.equals(request.originDeviceId, deviceId);
        if (ours && request.runId && !(await runHasTerminalStatus(store.view, chatId, request.runId))) {
            handed.push(request);
        }
    }
    return handed;
}
export function takeBack(requests, into) {
    for (const request of requests) {
        into.dispatch('take-run-request', { id: request.id, at: Date.now() });
    }
}
