import { requireMesh } from './current-mesh.js';
import { watchable } from './watchable.js';
export function createSyncApi(pool, log) {
    return {
        syncStatusWatch: watchable(async (request) => (await requireMesh(pool, request.meshId, { follow: true })).syncActivity ?? null, (_request, activity) => activity.snapshot(), { name: 'syncStatusWatch', log })
    };
}
