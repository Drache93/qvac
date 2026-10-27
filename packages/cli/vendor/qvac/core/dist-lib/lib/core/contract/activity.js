import b4a from 'b4a';
import { DEVICES, DEVICES_BY_WRITER_KEY, INDEX_BACKFILLS, LIVE_DEVICES_BY_WRITER_KEY, WRITER_ACTIVITY } from '../collections.js';
export function trackActivity(handler) {
    return async (op, ctx) => {
        const applied = await handler(op, ctx);
        if (applied) {
            await recordActivity(ctx.tx, ctx.node, ctx.host.clock);
        }
        return applied;
    };
}
export function devicesByWriterKey(tx, writerKey) {
    return tx.find(DEVICES_BY_WRITER_KEY, {
        gte: { writerKey },
        lte: { writerKey }
    });
}
export async function liveDeviceForWriter(db, writerKey) {
    if (!(await liveDevicesIndexed(db))) {
        for await (const device of devicesByWriterKey(db, writerKey)) {
            if (!device.revoked)
                return device;
        }
        return null;
    }
    return db.findOne(LIVE_DEVICES_BY_WRITER_KEY, {
        gte: { writerKey },
        lte: { writerKey }
    });
}
export async function liveDevicesIndexed(db) {
    return ((await db.get(INDEX_BACKFILLS, { index: LIVE_DEVICES_BY_WRITER_KEY })) !==
        null);
}
export async function backfillLiveDevices(tx) {
    const indexed = new Set();
    for await (const device of tx.find(LIVE_DEVICES_BY_WRITER_KEY)) {
        indexed.add(b4a.toHex(device.id));
    }
    for await (const device of tx.find(DEVICES)) {
        if (device.revoked || !device.writerKey || indexed.has(b4a.toHex(device.id))) {
            continue;
        }
        await tx.insert(DEVICES, { ...device, version: undefined });
    }
    await tx.insert(INDEX_BACKFILLS, { index: LIVE_DEVICES_BY_WRITER_KEY });
}
export async function markWriterRevoked(tx, writerKey, opts) {
    const { revoked } = opts;
    const existing = await tx.get(WRITER_ACTIVITY, { writerKey });
    if (!existing || existing.revoked === revoked) {
        return;
    }
    await tx.insert(WRITER_ACTIVITY, { ...existing, revoked });
}
export async function recordActivity(tx, node, clock) {
    const existing = await tx.get(WRITER_ACTIVITY, { writerKey: node.key });
    if (existing && existing.length >= node.length) {
        return;
    }
    const device = existing ? null : await devicesByWriterKey(tx, node.key).one();
    const deviceId = existing?.deviceId ?? device?.id;
    if (!deviceId) {
        return;
    }
    await tx.insert(WRITER_ACTIVITY, {
        writerKey: node.key,
        deviceId,
        length: node.length,
        clock,
        revoked: existing ? existing.revoked : device?.revoked
    });
}
