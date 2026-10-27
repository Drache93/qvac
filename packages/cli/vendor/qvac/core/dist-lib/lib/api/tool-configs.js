import { deleteToolConfigs, getToolConfigs, listToolConfigs, setToolConfigs } from '../core/tool-configs.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { CoreError } from '../errors.js';
import { isRecord } from '../guards.js';
function ensureSettingsPayload(value) {
    if (!isRecord(value))
        throw new CoreError('TOOL_CONFIGS_INVALID');
    return value;
}
export function createToolConfigsApi(pool, log) {
    const query = async ({ agentId }, mesh) => ({
        configs: await listToolConfigs(mesh, agentId)
    });
    return {
        setToolConfigs: async ({ agentId, toolName, settings, meshId }) => setToolConfigs(await requireMesh(pool, meshId), { agentId, toolName, settings: ensureSettingsPayload(settings) }, await requireMesh(pool, meshId, { route: 'put-agent' })),
        deleteToolConfigs: async ({ agentId, toolName, meshId }) => deleteToolConfigs(await requireMesh(pool, meshId), { agentId, toolName }, await requireMesh(pool, meshId, { route: 'put-agent' })),
        listToolConfigs: async (request) => query(request, await requireMesh(pool, request.meshId)),
        toolConfigsWatch: meshWatchable(pool, query, { name: 'toolConfigsWatch', log })
    };
}
export { getToolConfigs };
