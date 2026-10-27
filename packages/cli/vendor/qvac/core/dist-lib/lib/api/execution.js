import { mustGetActiveAgent } from '../core/agent.js';
import { appendChunk, listChunks, requireProjectMember, requireStoppableRun } from '../core/chunk.js';
import { randomId } from '../core/id.js';
import { getChat, mustGetActiveChat } from '../core/chat.js';
import { parentRequestId, sendMessage } from '../core/send.js';
import { accountPicks } from '../core/shared-agents.js';
import { ourSenderName } from '../core/senders.js';
import { requireMesh } from './current-mesh.js';
import { isMobilePlatform } from '@qvac/harness/lib/models/model-catalog.ts';
const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled']);
async function askableMesh(pool, meshId) {
    const mesh = await requireMesh(pool, meshId);
    await requireProjectMember(mesh, meshId);
    return mesh;
}
export function createExecutionApi(pool, deviceId, { account = () => null, agents = null, senders = null, peers = null, platform = null } = {}) {
    const picks = agents ?? accountPicks(account);
    const askable = async (meshId, agentId, refusal) => {
        const mesh = await askableMesh(pool, meshId);
        await picks.pick(mesh, agentId, refusal);
        return mesh;
    };
    const chatAgent = async (meshId, chatId) => (await mustGetActiveChat(await askableMesh(pool, meshId), chatId)).agentId;
    return {
        sendMessage: async (input) => {
            const kept = input.agentId ? null : input.chatId;
            const mesh = kept
                ? await askable(input.meshId, await chatAgent(input.meshId, kept), 'CHAT_AGENT_UNAVAILABLE')
                : await askable(input.meshId, input.agentId);
            return sendMessage(mesh, {
                text: input.text,
                senderNameAtSend: await ourSenderName(mesh, input.meshId, senders),
                chatId: input.chatId ?? undefined,
                agentId: input.agentId ?? undefined,
                title: input.title ?? undefined,
                parentRunId: input.parentRunId ?? undefined,
                capability: input.capability ?? undefined,
                capabilityArgs: input.capabilityArgs ?? undefined,
                enhance: input.enhance ?? undefined,
                originDeviceId: deviceId,
                peers: isMobilePlatform(platform?.() ?? '')
                    ? (peers?.snapshot().peerDeviceIds ?? undefined)
                    : undefined
            });
        },
        runAgent: async ({ chatId, agentId, parentRunId, meshId, capability, capabilityArgs, enhance }) => {
            const kept = (await getChat(await askableMesh(pool, meshId), chatId))?.agentId === agentId;
            const mesh = await askable(meshId, agentId, kept ? 'CHAT_AGENT_UNAVAILABLE' : undefined);
            await mustGetActiveAgent(mesh, agentId);
            const parentId = parentRunId ? await parentRequestId(mesh, chatId, parentRunId) : undefined;
            await appendChunk(mesh, {
                chatId,
                runId: randomId(),
                type: 'run-request',
                runRequest: { agentId },
                capability: capability ?? undefined,
                capabilityArgs: capabilityArgs ?? undefined,
                enhance: enhance ?? undefined,
                parentId,
                originDeviceId: deviceId
            });
            return { ok: true };
        },
        stopRun: async ({ chatId, runId, meshId }) => {
            const mesh = await requireMesh(pool, meshId);
            await requireStoppableRun(mesh, { meshId, chatId, runId });
            const statuses = await listChunks(mesh, { chatId, type: 'run-status' });
            const settled = statuses.some((c) => c.runId === runId && TERMINAL_STATES.has(c.runStatus?.state ?? ''));
            if (settled) {
                return { ok: true };
            }
            await appendChunk(mesh, {
                chatId,
                runId,
                type: 'run-status',
                runStatus: { state: 'canceled' },
                originDeviceId: deviceId
            });
            return { ok: true };
        }
    };
}
