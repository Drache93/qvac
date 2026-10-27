import { unref } from '../unref.js';
import b4a from 'b4a';
import { DEVICES } from './collections.js';
const MIN_SYNCING_MS = 1000;
export function createSyncActivity(mesh) {
    const listeners = new Set();
    const notify = () => {
        for (const listener of [...listeners]) {
            listener();
        }
    };
    const track = (writer) => {
        writer.core.on('append', notify);
        writer.core.on('download', notify);
    };
    mesh.watch(notify);
    mesh.autobee.on('writer', (writer) => track(writer));
    for (const writer of mesh.autobee.activeWriters) {
        track(writer);
    }
    mesh.autobee.local.on('upload', notify);
    mesh.autobee.local.on('peer-remove', notify);
    return {
        watch: (listener) => void listeners.add(listener),
        unwatch: (listener) => void listeners.delete(listener),
        once: (event, listener) => mesh.once(event, listener),
        off: (event, listener) => mesh.off(event, listener),
        get closing() {
            return mesh.closing;
        },
        get closed() {
            return mesh.closed;
        },
        hold: createSyncHold(notify),
        snapshot: () => syncStatusSnapshot(mesh)
    };
}
function createSyncHold(notify) {
    let busyUntil = 0;
    let timer = null;
    return {
        keep(busy) {
            if (busy) {
                busyUntil = Date.now() + MIN_SYNCING_MS;
                return true;
            }
            const remaining = busyUntil - Date.now();
            if (remaining <= 0) {
                return false;
            }
            if (timer === null) {
                timer = setTimeout(() => {
                    timer = null;
                    notify();
                }, remaining);
                unref(timer);
            }
            return true;
        }
    };
}
export async function syncStatusSnapshot(mesh) {
    const deviceByWriter = await writerDeviceMap(mesh);
    const localKey = mesh.autobee.local.key;
    const sessions = openWriterSessions(mesh);
    const remoteWriters = [...new Set([...deviceByWriter.keys(), ...sessions.keys()])]
        .map((hex) => {
        const session = sessions.get(hex);
        const device = deviceByWriter.get(hex);
        return { session, device, writerKey: session ? session.core.key : b4a.from(hex, 'hex') };
    })
        .filter((writer) => !b4a.equals(writer.writerKey, localKey));
    const rows = await Promise.all(remoteWriters.map(async ({ session, device, writerKey }) => {
        const info = await mesh.autobee.system.get(writerKey, { unflushed: true });
        return {
            device,
            writerKey,
            info,
            length: session?.core.length ?? 0,
            contiguousLength: session?.core.contiguousLength ?? 0
        };
    }));
    const devices = [];
    let pendingOps = 0;
    for (const { device, writerKey, info, length, contiguousLength } of rows) {
        if (info?.isRemoved)
            continue;
        const known = Math.max(info?.length ?? 0, length);
        const applied = Math.max(info?.length ?? 0, contiguousLength);
        pendingOps += Math.max(0, known - applied);
        devices.push({
            writerKey,
            deviceId: device?.id,
            applied,
            known
        });
    }
    const pendingUploads = mesh.pendingUploads();
    const syncing = mesh.syncActivity.hold.keep(pendingOps + pendingUploads > 0);
    return {
        state: statusState(devices.length, syncing),
        pendingOps,
        pendingUploads,
        devices
    };
}
function statusState(writerCount, syncing) {
    if (writerCount === 0)
        return 'idle';
    return syncing ? 'syncing' : 'synced';
}
function openWriterSessions(mesh) {
    const sessions = new Map();
    for (const writer of mesh.autobee.activeWriters) {
        sessions.set(b4a.toHex(writer.core.key), writer);
    }
    return sessions;
}
async function writerDeviceMap(mesh) {
    const map = new Map();
    const snap = mesh.view.snapshot();
    try {
        for await (const device of snap.find(DEVICES)) {
            if (device.writerKey && !device.revoked) {
                map.set(b4a.toHex(device.writerKey), device);
            }
        }
    }
    finally {
        await snap.close();
    }
    return map;
}
