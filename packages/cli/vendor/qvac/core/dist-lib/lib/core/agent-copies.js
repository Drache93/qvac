import { cancelRunsForAgent, softDeleteChatsForAgent } from './chat.js';
import { stripped } from './chat-copy.js';
import { AGENTS } from './collections.js';
async function putNewer(account, into, { id, copy }) {
    const agent = await account.view.get(AGENTS, { id });
    if (!agent || (copy && copy.updatedAt >= agent.updatedAt)) {
        return null;
    }
    await into.dispatch('put-agent', { agent: stripped(agent) });
    return agent;
}
export async function copyAgent(account, into, agentId) {
    if (!account || !agentId || into.role !== 'public')
        return;
    const copy = await into.view.get(AGENTS, { id: agentId });
    await putNewer(account, into, { id: agentId, copy });
}
export async function followAgentCopies(account, into, { deviceId, agentId }) {
    const copies = agentId
        ? [await into.view.get(AGENTS, { id: agentId })]
        : await into.view.find(AGENTS).toArray();
    for (const copy of copies) {
        if (!copy || into.closing)
            continue;
        const agent = await putNewer(account, into, { id: copy.id, copy });
        if (agent?.deletedAt && !copy.deletedAt) {
            await softDeleteChatsForAgent(into, deviceId, agent.id);
        }
    }
}
export async function keepCopyChats(into, agent, deviceId) {
    const copy = await into.view.get(AGENTS, { id: agent.id });
    if (!copy || copy.deletedAt) {
        return;
    }
    await into.dispatch('put-agent', { agent: stripped(agent) });
    if (deviceId) {
        await cancelRunsForAgent(into, deviceId, agent.id);
    }
}
