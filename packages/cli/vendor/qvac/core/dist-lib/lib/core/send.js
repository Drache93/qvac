import { CoreError } from '../errors.js';
import { mustGetActiveAgent } from './agent.js';
import { buildChat, enrichChat, mustGetActiveChat } from './chat.js';
import { appendChunk, listChunks } from './chunk.js';
import { randomId } from './id.js';
import { handedOffRequests, pickRunner, takeBack } from './run-requests.js';
import { runDefinition } from './shared-agents.js';
export async function sendMessage(mesh, input) {
    const existing = input.chatId ? await mustGetActiveChat(mesh, input.chatId) : null;
    const agentId = input.agentId ?? existing?.agentId;
    if (!agentId) {
        throw new CoreError('SEND_AGENT_REQUIRED');
    }
    const agent = await runDefinition(mesh, await mustGetActiveAgent(mesh, agentId));
    const chat = existing ?? buildChat({ agentId, title: input.title ?? '' });
    const chatId = chat.id;
    const parentId = input.parentRunId
        ? await parentRequestId(mesh, chatId, input.parentRunId)
        : undefined;
    const runId = randomId();
    const { originDeviceId } = input;
    const handed = existing ? await handedOffRequests(mesh, originDeviceId, chatId) : [];
    const runner = agent && input.peers && !input.capability && !handed.length
        ? await pickRunner(mesh, { deviceId: originDeviceId, peers: input.peers, agent })
        : undefined;
    const batch = mesh.batch();
    if (!existing) {
        batch.dispatch('put-chat', { chat });
    }
    takeBack(handed, batch);
    const { id: chunkId } = await appendChunk(mesh, {
        chatId,
        type: 'user-message',
        userMessage: { text: input.text },
        originDeviceId,
        senderNameAtSend: input.senderNameAtSend
    }, batch);
    await appendChunk(mesh, {
        chatId,
        runId,
        type: 'run-request',
        runRequest: { agentId },
        capability: input.capability,
        capabilityArgs: input.capabilityArgs,
        enhance: input.enhance,
        parentId,
        originDeviceId,
        runnerDeviceId: runner
    }, batch);
    await batch.flush();
    return {
        chatId,
        chunkId,
        runId,
        chat: existing ? undefined : await enrichChat(mesh, chat)
    };
}
export async function parentRequestId(mesh, chatId, parentRunId) {
    const requests = await listChunks(mesh, { chatId, type: 'run-request' });
    const parent = requests.find((chunk) => chunk.runId === parentRunId);
    if (!parent) {
        throw new CoreError('RUN_NOT_FOUND', [parentRunId]);
    }
    return parent.id;
}
