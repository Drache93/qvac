import { buildHealthAssistant, HEALTH_ASSISTANT_ID } from '../health-assistant.js';
import { AGENTS } from '../collections.js';
const MIGRATION_BASELINE_AT = 0;
export async function migrateAgentCatalog(mesh, { device }) {
    const snap = mesh.view.snapshot();
    try {
        if (await snap.get(AGENTS, { id: HEALTH_ASSISTANT_ID })) {
            return false;
        }
    }
    finally {
        await snap.close();
    }
    await mesh.dispatch('migrate-agent-catalog', {
        agent: buildHealthAssistant(device, { at: MIGRATION_BASELINE_AT })
    });
    return true;
}
