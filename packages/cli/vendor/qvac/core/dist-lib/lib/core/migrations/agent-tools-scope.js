import { allTools } from '../agent.js';
import { AGENTS } from '../collections.js';
export async function migrateAgentToolsScope(mesh) {
    const scoped = await selectedScopeAgents(mesh);
    for (const agent of scoped) {
        await mesh.dispatch('put-agent', { agent: { ...agent, ...allTools() } });
    }
    return scoped.length > 0;
}
async function selectedScopeAgents(mesh) {
    const snap = mesh.view.snapshot();
    try {
        const scoped = [];
        for await (const agent of snap.find(AGENTS)) {
            if (!agent.deletedAt && agent.toolsScope === 'selected') {
                scoped.push(agent);
            }
        }
        return scoped;
    }
    finally {
        await snap.close();
    }
}
