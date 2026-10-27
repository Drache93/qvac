import b4a from 'b4a';
import { stripped } from './chat-copy.js';
import { setChatAgent } from './chat.js';
import { shareAgent } from './shared-agents.js';
import { ACTIVE_CHATS_BY_AGENT, AGENTS } from './collections.js';
function definition(agent) {
    const list = (values) => (values ? [...values].sort() : null);
    const tools = agent.enabledTools ?? null;
    return JSON.stringify([
        agent.name,
        agent.bio,
        b4a.toHex(agent.providerDeviceId),
        agent.modelName,
        agent.iconName ?? null,
        agent.reasoning ?? null,
        agent.kvCacheK ?? null,
        agent.kvCacheV ?? null,
        list(agent.enabledSkills),
        list(agent.installedSkills ?? agent.enabledSkills),
        list(tools),
        agent.toolsScope ?? (tools === null ? 'all' : 'selected'),
        list(agent.disabledToolsets) ?? [],
        agent.approvalMode ?? 'ask',
        agent.imageModelChoice ?? null,
        agent.ctxSize ?? null
    ]);
}
export async function ownCopies(workspace, deviceId) {
    const rows = await workspace.view.find(AGENTS).toArray();
    return rows.filter((row) => !row.deletedAt && b4a.equals(row.providerDeviceId, deviceId));
}
export async function foldAgents(fold, copies) {
    const { account } = fold;
    const originals = await account.view.find(AGENTS).toArray();
    for (const copy of copies) {
        const own = originals.find((agent) => agent.id === copy.id);
        if (own?.deletedAt) {
            continue;
        }
        const twin = own
            ? null
            : originals.find((agent) => !agent.deletedAt && definition(agent) === definition(copy));
        await (twin ? foldTwin(fold, copy, twin) : adopt(fold, copy, !!own));
    }
}
async function foldTwin({ account, workspace, projects, picks }, copy, twin) {
    await shareAgent(account, workspace, twin.id);
    for (const project of projects) {
        const chats = await chatsOf(project, copy.id);
        if (chats.length === 0) {
            continue;
        }
        await picks.pick(project, twin.id);
        for (const chat of chats) {
            await setChatAgent(project, chat.id, twin.id);
        }
        await picks.unpick(project, copy.id);
    }
    const at = Math.max(Date.now(), copy.updatedAt + 1);
    await workspace.dispatch('put-agent', {
        agent: { ...stripped(copy), deletedAt: at, updatedAt: at }
    });
}
async function adopt({ account, workspace, projects, picks }, copy, held) {
    if (!held) {
        await account.dispatch('put-agent', { agent: { ...stripped(copy), isDefault: false } });
    }
    await shareAgent(account, workspace, copy.id);
    for (const project of projects) {
        if ((await chatsOf(project, copy.id)).length > 0) {
            await picks.pick(project, copy.id);
        }
    }
}
function chatsOf(project, agentId) {
    const range = { gte: { agentId }, lte: { agentId } };
    return project.view.find(ACTIVE_CHATS_BY_AGENT, range).toArray();
}
