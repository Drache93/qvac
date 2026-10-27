import { liveDeviceForWriter, trackActivity } from './activity.js';
import { adminSigner, isWorkspace } from './workspace.js';
import { meshNameWithinBounds } from '../../../schema/qvac.js';
import { MESH_NAMES } from '../collections.js';
export const MESH_NAME_ROW = 'mesh';
export function registerMeshNameRoutes(router) {
    router.add('@qvac/name-mesh', trackActivity(async ({ name, namedAt }, { tx, node, log }) => {
        if (!meshNameWithinBounds(name)) {
            log?.warn('contract', 'name-mesh dropped: name over the cap', { length: name.length });
            return;
        }
        if ((await isWorkspace(tx)) && !(await adminSigner({ tx, node }))) {
            log?.warn('contract', 'name-mesh dropped: only an admin renames a workspace');
            return;
        }
        const existing = await tx.get(MESH_NAMES, { id: MESH_NAME_ROW });
        if (existing && existing.namedAt >= namedAt) {
            log?.debug('contract', 'name-mesh dropped: stale namedAt', { namedAt });
            return;
        }
        const row = {
            id: MESH_NAME_ROW,
            name,
            namedAt,
            namedBy: (await liveDeviceForWriter(tx, node.key))?.memberId
        };
        await tx.insert(MESH_NAMES, row);
        log?.debug('contract', 'mesh named', { namedAt });
        return row;
    }));
}
