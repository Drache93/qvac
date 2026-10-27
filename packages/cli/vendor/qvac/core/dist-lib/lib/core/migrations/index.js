import { inRole } from '../contract/roles.js';
import { migrateAgentCatalog } from './agent-catalog.js';
import { migrateAgentToolsScope } from './agent-tools-scope.js';
import { migrateMembership } from './membership.js';
import { sealDeviceRows } from './seal.js';
import { reindexAgents } from './agent-indexes.js';
import { reindexDevices } from './device-indexes.js';
export async function runMigrations(mesh, context, { catalog = true } = {}) {
    const devices = await reindexDevices(mesh);
    const membership = await migrateMembership(mesh, context);
    const holdsAgents = mesh.role !== 'public' && inRole(mesh.role, '@qvac/put-agent');
    const agents = holdsAgents && catalog && (await migrateAgentCatalog(mesh, context));
    const seal = await sealDeviceRows(mesh, context);
    const indexed = await reindexAgents(mesh);
    const tools = holdsAgents && (await migrateAgentToolsScope(mesh));
    return devices || membership || agents || seal || indexed || tools;
}
