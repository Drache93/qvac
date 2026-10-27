import { MESH_NAMES } from '../core/collections.js';
import { MESH_NAME_ROW } from '../core/contract/mesh-name.js';
import { WORKSPACE_ROW, readWorkspace } from '../core/contract/workspace.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { requireOurAdmin, requireWorkspace } from './members.js';
async function read(mesh, meshId) {
    requireWorkspace(mesh, meshId);
    const row = await readWorkspace(mesh.view);
    const named = await mesh.view.get(MESH_NAMES, { id: MESH_NAME_ROW });
    return { meshId, name: named?.name ?? '', icon: row?.icon || undefined };
}
export function createWorkspaceApi(pool, status, log) {
    return {
        createWorkspace: async (request) => {
            const meshId = await status.createWorkspace({
                name: request?.config?.name ?? undefined,
                icon: request?.config?.icon ?? undefined
            });
            return read(await requireMesh(pool, meshId), meshId);
        },
        getWorkspace: async ({ meshId }) => read(await requireMesh(pool, meshId), meshId),
        workspaceWatch: meshWatchable(pool, ({ meshId }, mesh) => read(mesh, meshId), { name: 'workspaceWatch', log }),
        updateWorkspace: async (request) => update(await requireMesh(pool, request.meshId), request, status),
        leaveWorkspace: async ({ meshId }) => {
            requireWorkspace(await requireMesh(pool, meshId), meshId);
            await status.leaveWorkspace(meshId);
            return { ok: true };
        }
    };
}
async function update(mesh, { meshId, config }, status) {
    requireWorkspace(mesh, meshId);
    await requireOurAdmin(mesh, 'edit the workspace');
    if (config.name) {
        await status.name(meshId, config.name);
    }
    if (config.icon) {
        const existing = await readWorkspace(mesh.view);
        await mesh.dispatch('put-workspace', {
            workspace: {
                id: WORKSPACE_ROW,
                icon: config.icon,
                updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1)
            }
        });
    }
    return read(mesh, meshId);
}
