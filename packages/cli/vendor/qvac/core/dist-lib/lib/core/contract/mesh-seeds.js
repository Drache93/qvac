import { liveDeviceForWriter, trackActivity } from './activity.js';
import b4a from 'b4a';
import { MESH_SEEDS } from '../collections.js';
import { sharedKind } from './mesh-kind.js';
export function registerMeshSeedRoutes(router) {
    router.add('@qvac/put-mesh-seed', trackActivity(async ({ meshKey, seed }, { tx, node, log }) => {
        const ids = { meshKey: b4a.toHex(meshKey).slice(0, 8) };
        if (await sharedKind(tx)) {
            log?.warn('contract', 'put-mesh-seed dropped: seeds live in the account alone', ids);
            return;
        }
        const author = await liveDeviceForWriter(tx, node.key);
        if (!author?.memberId) {
            log?.warn('contract', 'put-mesh-seed dropped: the author speaks for no member here', ids);
            return;
        }
        const held = await tx.get(MESH_SEEDS, { meshKey });
        if (held && b4a.equals(held.seed, seed)) {
            log?.debug('contract', 'put-mesh-seed dropped: the account already holds it', ids);
            return;
        }
        const row = { meshKey, seed };
        await tx.insert(MESH_SEEDS, row);
        return row;
    }));
}
