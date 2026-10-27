import b4a from 'b4a';
import { DEVICES, PROJECT_HOST_KEYS } from '../collections.js';
import { liveAgentsOn, usesAny } from './public-seeds.js';
export function readProjectHostKey(tx, projectId, deviceId) {
    return tx.get(PROJECT_HOST_KEYS, { projectId, deviceId });
}
function hostKeysOf(tx, projectId) {
    const range = { gte: { projectId }, lte: { projectId } };
    return tx.find(PROJECT_HOST_KEYS, range).toArray();
}
export async function dropProjectHostKeys(tx, projectId) {
    for (const row of await hostKeysOf(tx, projectId)) {
        await tx.delete(PROJECT_HOST_KEYS, { projectId, deviceId: row.deviceId });
    }
}
export async function dropMemberHostKeys(tx, projectId, memberId) {
    for (const row of await hostKeysOf(tx, projectId)) {
        const device = await tx.get(DEVICES, { id: row.deviceId });
        if (device?.memberId && b4a.equals(device.memberId, memberId)) {
            await tx.delete(PROJECT_HOST_KEYS, { projectId, deviceId: row.deviceId });
        }
    }
}
async function hostKeysSealedTo(tx, deviceId) {
    const rows = await tx.find(PROJECT_HOST_KEYS).toArray();
    return rows.filter((row) => b4a.equals(row.deviceId, deviceId));
}
export async function dropDeviceHostKeys(tx, deviceId) {
    for (const row of await hostKeysSealedTo(tx, deviceId)) {
        await tx.delete(PROJECT_HOST_KEYS, { projectId: row.projectId, deviceId });
    }
}
export async function pruneProjectHostKeys(tx, deviceId) {
    const agents = await liveAgentsOn(tx, deviceId);
    for (const row of await hostKeysSealedTo(tx, deviceId)) {
        if (!(await usesAny(tx, agents, row.projectId))) {
            await tx.delete(PROJECT_HOST_KEYS, { projectId: row.projectId, deviceId });
        }
    }
}
