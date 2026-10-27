import b4a from 'b4a';
import { PROJECT_DEVICE_KEYS } from '../collections.js';
export function readProjectDeviceKey(tx, projectId, deviceId) {
    return tx.get(PROJECT_DEVICE_KEYS, { projectId, deviceId });
}
function deviceKeysOf(tx, projectId) {
    const range = { gte: { projectId }, lte: { projectId } };
    return tx.find(PROJECT_DEVICE_KEYS, range).toArray();
}
async function drop(tx, rows, match) {
    for (const row of rows.filter(match)) {
        await tx.delete(PROJECT_DEVICE_KEYS, { projectId: row.projectId, deviceId: row.deviceId });
    }
}
function allRows(tx) {
    return tx.find(PROJECT_DEVICE_KEYS).toArray();
}
export async function dropProjectDeviceKeys(tx, projectId) {
    await drop(tx, await deviceKeysOf(tx, projectId), () => true);
}
export async function dropListingDeviceKeys(tx, projectId, memberId) {
    await drop(tx, await deviceKeysOf(tx, projectId), (row) => b4a.equals(row.memberId, memberId));
}
export async function dropMemberDeviceKeys(tx, memberId) {
    await drop(tx, await allRows(tx), (row) => b4a.equals(row.memberId, memberId));
}
export async function dropDeviceKeysOf(tx, deviceId) {
    await drop(tx, await allRows(tx), (row) => b4a.equals(row.deviceId, deviceId));
}
