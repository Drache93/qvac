import { ACTIVE_AGENTS, AGENTS_BY_PROVIDER } from '../collections.js';
export async function reindexAgents(mesh) {
    if (!mesh.writable)
        return false;
    const missing = await unindexedAgentIds(mesh);
    if (missing.length === 0) {
        return false;
    }
    await mesh.dispatch('reindex-agents', { agentIds: missing });
    return true;
}
async function unindexedAgentIds(mesh) {
    const snap = mesh.view.snapshot();
    try {
        const indexed = new Set();
        for await (const agent of snap.find(AGENTS_BY_PROVIDER)) {
            indexed.add(agent.id);
        }
        const missing = [];
        for await (const agent of snap.find(ACTIVE_AGENTS)) {
            if (!indexed.has(agent.id)) {
                missing.push(agent.id);
            }
        }
        return missing;
    }
    finally {
        await snap.close();
    }
}
