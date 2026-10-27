import { listModelRequests } from '../core/model-requests.js';
import { servedChats } from '../core/public-mesh.js';
import { createChunksApi } from './chunks.js';
import { requireMesh, routed } from './current-mesh.js';
import { watchable } from './watchable.js';
export const SERVED_ROUTES = [
    'listMeshes',
    'meshesWatch',
    'chatsWatch',
    'listChunks',
    'chunksWatch',
    'appendChunk',
    'modelRequestsWatch',
    'takeModelRequest',
    'settleModelRequest'
];
export function createServedApi({ pool, local, foreign, status, list, deviceId, log }) {
    const chunks = createChunksApi(routed(pool, 'append-chunk'), deviceId, { log });
    const chatsWatch = watchable(({ meshId }) => requireMesh(pool, meshId, { follow: true, wide: true }), async (_request, mesh) => ({
        chats: (deviceId ? await servedChats(mesh, deviceId) : []).map(({ id, agentId, title, createdAt }) => ({
            id,
            agentId,
            title,
            createdAt
        }))
    }), { name: 'chatsWatch', log });
    const rounds = watchable(({ meshId }) => requireMesh(pool, meshId, { follow: true, wide: true }), async (_request, mesh) => {
        const chats = new Set((deviceId ? await servedChats(mesh, deviceId) : []).map(({ id }) => id));
        const live = await listModelRequests(mesh);
        return { chunks: live.filter((round) => chats.has(round.chatId)) };
    }, { name: 'modelRequestsWatch', log });
    const { chatsWatch: ownChats = chatsWatch, appendChunk: ownAppend = chunks.appendChunk } = local;
    return {
        listMeshes: list,
        meshesWatch: watchable(() => status, list, {
            name: 'meshesWatch',
            log
        }),
        chatsWatch: (request) => (foreign(request.meshId) ? chatsWatch(request) : ownChats(request)),
        listChunks: chunks.listChunks,
        chunksWatch: chunks.chunksWatch,
        appendChunk: (request) => foreign(request.meshId) ? chunks.appendChunk(request) : ownAppend(request),
        modelRequestsWatch: (request) => foreign(request.meshId) ? rounds(request) : chunks.modelRequestsWatch(request),
        takeModelRequest: chunks.takeModelRequest,
        settleModelRequest: chunks.settleModelRequest
    };
}
