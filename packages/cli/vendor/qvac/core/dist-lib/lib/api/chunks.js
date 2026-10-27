import { answersRound, appendChunk, listAttachmentsByKind, listChunks, listRunRequests, othersApproval, recordLinks, requireChatIn, requireOwnRun, requireProjectMember, resolveApproval, updateChunk } from '../core/chunk.js';
import { cancelModelRequest, listModelRequests, reopenModelRequest, settleModelRequest, takeModelRequest } from '../core/model-requests.js';
import { takeRunRequest } from '../core/run-requests.js';
import { accountPicks } from '../core/shared-agents.js';
import { chunkDeltaStream } from './chunk-delta.js';
import { ourSenderName, withSenders } from '../core/senders.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { bounds } from './range.js';
import { CoreError } from '../errors.js';
export function createChunksApi(pool, deviceId, { log, account = null, agents = null, senders = null }) {
    const transcript = async ({ meshId, ...input }, mesh) => {
        mesh.focusChat(input.chatId);
        const [chunks, named] = await Promise.all([
            listChunks(mesh, chunkSelection(input)),
            senders?.lookup(meshId) ?? null
        ]);
        return { chunks: withSenders(await recordLinks(mesh, chunks), named) };
    };
    const chunksWatch = meshWatchable(pool, transcript, { name: 'chunksWatch', log, changes: senders?.changes });
    return {
        appendChunk: async ({ meshId, ...input }) => {
            const mesh = await requireMesh(pool, meshId, { chatId: input.chatId });
            await requireChatIn(mesh, input.chatId);
            const ownRun = input.type !== 'run-request' && !(await answersRound(mesh, input.parentId));
            if (input.runId && ownRun) {
                await requireOwnRun(mesh, input.chatId, input.runId);
            }
            await (agents ?? accountPicks(() => account?.() ?? null)).pick(mesh, input.runRequest?.agentId);
            const senderNameAtSend = input.type === 'user-message'
                ? await ourSenderName(mesh, meshId, senders?.lookup)
                : undefined;
            return appendChunk(mesh, { ...input, senderNameAtSend });
        },
        updateChunk: async ({ meshId, chunkId, runStatus }) => {
            await updateChunk(await requireMesh(pool, meshId), { id: chunkId, runStatus });
            return { ok: true };
        },
        resolveApproval: async (input) => {
            const mesh = await requireMesh(pool, input.meshId);
            await requireProjectMember(mesh, input.meshId);
            const rules = (await othersApproval(mesh, input.chunkId))
                ? (account?.() ?? null)
                : await requireMesh(pool, input.meshId, { route: 'put-approval-rule' });
            await resolveApproval(mesh, {
                id: input.chunkId,
                approved: input.approved === true,
                scope: input.scope ?? undefined,
                expiresAt: input.expiresAt || undefined,
                agentId: input.agentId ?? undefined
            }, rules);
            return { ok: true };
        },
        listChunks: async (input) => transcript(input, await requireMesh(pool, input.meshId, { chatId: input.chatId })),
        listAttachmentsByKind: async ({ meshId, ...input }) => {
            const mesh = await requireMesh(pool, meshId);
            const chunks = await listAttachmentsByKind(mesh, {
                ...bounds(input),
                kind: input.kind,
                origin: input.origin ?? undefined
            });
            return { chunks: await recordLinks(mesh, chunks) };
        },
        chunksWatch,
        chunksDeltaWatch: (request) => chunkDeltaStream(chunksWatch(request)),
        runRequestsWatch: meshWatchable(pool, async (_request, mesh) => ({ chunks: await listRunRequests(mesh, deviceId) }), { name: 'runRequestsWatch', log }),
        takeModelRequest: async ({ meshId, chunkId }) => takeModelRequest(await requireMesh(pool, meshId, { chunkId }), chunkId),
        settleModelRequest: async ({ meshId, chunkId, state, result, reason }) => {
            if (state !== 'done' && state !== 'failed') {
                throw new CoreError('CHUNK_PAYLOAD_INVALID', ['a model-request settles done or failed']);
            }
            await settleModelRequest(await requireMesh(pool, meshId, { chunkId }), {
                id: chunkId,
                state,
                result,
                reason: reason ?? undefined
            });
            return { ok: true };
        },
        cancelModelRequest: async ({ meshId, chunkId }) => {
            await cancelModelRequest(await requireMesh(pool, meshId), chunkId);
            return { ok: true };
        },
        reopenModelRequest: async ({ meshId, chunkId }) => {
            await reopenModelRequest(await requireMesh(pool, meshId, { chunkId }), chunkId);
            return { ok: true };
        },
        modelRequestsWatch: meshWatchable(pool, async (_request, mesh) => ({ chunks: await listModelRequests(mesh) }), { name: 'modelRequestsWatch', log }),
        takeRunRequest: async ({ meshId, chunkId }) => takeRunRequest(await requireMesh(pool, meshId), chunkId)
    };
}
function chunkSelection({ chatId, type, types, ...rest }) {
    return { ...bounds(rest), chatId, type: type ?? undefined, types: types ?? undefined };
}
