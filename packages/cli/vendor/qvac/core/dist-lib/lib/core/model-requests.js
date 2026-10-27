import { CoreError } from '../errors.js';
import { getChunk, mustGetChunk } from './chunk.js';
import { asModelRequest, ownerSigner, takenBySigner, takerFor } from './contract/model-requests.js';
import { LIVE_MODEL_REQUESTS } from './collections.js';
async function liveRequest(store, id) {
    const request = asModelRequest(await getChunk(store, id));
    if (!request) {
        throw new CoreError('CHUNK_NOT_FOUND', [id]);
    }
    const { state } = request.modelRequest;
    if (state !== 'open' && state !== 'taken') {
        throw new CoreError('MODEL_REQUEST_CLOSED', [id]);
    }
    return request;
}
async function ownersRequest(store, id) {
    const request = await liveRequest(store, id);
    if (!(await ownerSigner(store.view, request, store.localWriterKey))) {
        throw new CoreError('MODEL_REQUEST_NOT_OURS', [id]);
    }
    return request;
}
export async function takeModelRequest(store, id) {
    const request = await liveRequest(store, id);
    if (!(await takerFor(store.view, request, store.localWriterKey))) {
        throw new CoreError('MODEL_REQUEST_NOT_OURS', [id]);
    }
    await store.dispatch('take-model-request', { id, at: Date.now() });
    return mustGetChunk(store, id);
}
export async function settleModelRequest(store, { id, state, result, reason }) {
    const request = await liveRequest(store, id);
    if (!(await takenBySigner(store.view, request, store.localWriterKey))) {
        throw new CoreError('MODEL_REQUEST_NOT_OURS', [id]);
    }
    await store.dispatch('settle-model-request', { id, state, result, reason, at: Date.now() });
}
export async function cancelModelRequest(store, id) {
    await ownersRequest(store, id);
    await store.dispatch('cancel-model-request', { id, at: Date.now() });
}
export async function reopenModelRequest(store, id) {
    const request = await ownersRequest(store, id);
    if (request.modelRequest.state === 'open') {
        return;
    }
    await store.dispatch('reopen-model-request', { id, at: Date.now() });
}
export async function listModelRequests(store) {
    const snap = store.view.snapshot();
    try {
        const live = await snap.find(LIVE_MODEL_REQUESTS).toArray();
        const ours = [];
        for (const chunk of live) {
            const request = asModelRequest(chunk);
            if (request && (await takerFor(snap, request, store.localWriterKey))) {
                ours.push(chunk);
            }
        }
        return ours;
    }
    finally {
        await snap.close();
    }
}
