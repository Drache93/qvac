import { liveDevicesIndexed } from '../contract/activity.js';
export async function reindexDevices(mesh) {
    if (!mesh.writable || (await liveDevicesIndexed(mesh.view)))
        return false;
    await mesh.dispatch('reindex-devices', {});
    return true;
}
