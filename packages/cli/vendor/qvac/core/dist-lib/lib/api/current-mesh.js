import { watchable } from './watchable.js';
import { CoreError, isCoreError } from '../errors.js';
export async function requireMesh(pool, meshId, request) {
    const mesh = await pool(meshId, request);
    if (!mesh) {
        throw new CoreError('MESH_NOT_FOUND', [meshId]);
    }
    if (!mesh.opened) {
        await mesh.ready();
    }
    return mesh;
}
export function heldMesh(pool, meshId, request) {
    return requireMesh(pool, meshId, request).catch((err) => {
        if (isCoreError(err, 'MESH_NOT_FOUND'))
            return null;
        throw err;
    });
}
export function meshWatchable(pool, query, options) {
    return watchable((request) => requireMesh(pool, request.meshId, { follow: true, chatId: request.chatId }), query, options);
}
export function routed(pool, route) {
    return (meshId, request) => pool(meshId, { ...request, route: request?.route ?? route });
}
