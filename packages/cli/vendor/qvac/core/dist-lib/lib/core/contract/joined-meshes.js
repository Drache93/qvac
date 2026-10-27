import { liveDeviceForWriter, trackActivity } from './activity.js';
import b4a from 'b4a';
import { JOINED_MESHES } from '../collections.js';
export function registerJoinedMeshRoutes(router) {
    router.add('@qvac/put-joined-mesh', trackActivity(async ({ room: mesh }, { tx, node, log }) => {
        const author = await liveDeviceForWriter(tx, node.key);
        if (!(author?.memberId && b4a.equals(author?.memberId, mesh.memberId))) {
            log?.warn('contract', 'put-joined-mesh refused: author is not a device of that member', {
                meshKey: b4a.toHex(mesh.meshKey).slice(0, 8)
            });
            return;
        }
        const existing = await tx.get(JOINED_MESHES, { meshKey: mesh.meshKey });
        if (existing && existing.joinedAt > mesh.joinedAt) {
            log?.debug('contract', 'put-joined-mesh dropped: stale joinedAt', {
                meshKey: b4a.toHex(mesh.meshKey).slice(0, 8)
            });
            return;
        }
        const rejoin = !!existing && mesh.joinedAt > existing.joinedAt;
        const next = existing ? merge(mesh, existing, rejoin) : mesh;
        await tx.insert(JOINED_MESHES, next);
        log?.debug('contract', next.leftAt ? 'joined mesh released' : 'joined mesh recorded', {
            meshKey: b4a.toHex(mesh.meshKey).slice(0, 8)
        });
        return next;
    }));
}
function merge(mesh, existing, rejoin) {
    const relabels = (mesh.labeledAt ?? 0) > (existing.labeledAt ?? 0);
    const remarks = (mesh.sharedAt ?? 0) > (existing.sharedAt ?? 0);
    return {
        meshKey: mesh.meshKey,
        memberId: mesh.memberId,
        joinedAt: mesh.joinedAt,
        leftAt: rejoin ? mesh.leftAt : mesh.leftAt || existing.leftAt,
        label: relabels ? mesh.label : existing.label,
        labeledAt: relabels ? mesh.labeledAt : existing.labeledAt,
        shared: remarks ? mesh.shared : existing.shared,
        sharedAt: remarks ? mesh.sharedAt : existing.sharedAt,
        workspace: existing.workspace || mesh.workspace
    };
}
