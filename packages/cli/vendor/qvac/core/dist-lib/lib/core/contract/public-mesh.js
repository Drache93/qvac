import b4a from 'b4a';
import { trackActivity } from './activity.js';
import { MESH_SEEDS, PUBLIC_MESHES } from '../collections.js';
export const PUBLIC_MESH_ROW = 'mesh';
const WORKSPACE_ID = /^[0-9a-f]{64}$/;
async function heldWorkspace(row, { tx }) {
    if (row.id === PUBLIC_MESH_ROW)
        return true;
    if (!WORKSPACE_ID.test(row.id))
        return false;
    return !!(await tx.get(MESH_SEEDS, { meshKey: b4a.from(row.id, 'hex') }));
}
export function registerPublicMeshRoutes(router) {
    router.add('@qvac/put-public-mesh', trackActivity(async (row, context) => {
        const { tx, log } = context;
        if (!(await heldWorkspace(row, context))) {
            log?.warn('contract', 'put-public-mesh dropped: the account holds no such workspace', {
                id: row.id.slice(0, 8)
            });
            return;
        }
        if (await tx.get(PUBLIC_MESHES, { id: row.id })) {
            log?.debug('contract', 'put-public-mesh dropped: the first row wins');
            return;
        }
        const stored = { id: row.id, meshKey: row.meshKey };
        await tx.insert(PUBLIC_MESHES, stored);
        log?.info('contract', 'public mesh recorded', { id: row.id.slice(0, 8) });
        return stored;
    }));
}
