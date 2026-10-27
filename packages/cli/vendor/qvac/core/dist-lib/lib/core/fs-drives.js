import BlindPeering from 'blind-peering';
import Hyperdrive from 'hyperdrive';
import HypercoreId from 'hypercore-id-encoding';
const NAMESPACE = 'fs-drives';
const DRIVE_OPEN_TIMEOUT_MS = 15_000;
function withDeadline(promise, ms) {
    const { promise: gated, resolve, reject } = Promise.withResolvers();
    const timer = setTimeout(() => reject(new Error('drive open timed out on the host')), ms);
    promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
    }, (err) => {
        clearTimeout(timer);
        reject(err);
    });
    return gated;
}
async function openDrive(store, swarm, key) {
    const drive = new Hyperdrive(store, HypercoreId.decode(key));
    await drive.ready();
    const topic = swarm.join(drive.discoveryKey, { server: false, client: true });
    const donePeering = drive.findingPeers();
    topic.flushed().then(donePeering, donePeering);
    return { drive, writable: drive.writable, topic };
}
export function createFsDriveHost(store, opts) {
    const namespaced = store.namespace(NAMESPACE);
    const drives = new Map();
    async function peer(held) {
        const peering = opts.blindPeering();
        if (!peering) {
            return;
        }
        const blobs = await held.drive.getBlobs();
        peering.addCoreBackground(held.drive.core, { keys: opts.blindPeerKeys, pick: 2 });
        if (blobs) {
            peering.addCoreBackground(blobs.core, { keys: opts.blindPeerKeys, pick: 2 });
        }
    }
    async function acquire(key) {
        const cached = drives.get(key);
        if (cached) {
            return cached;
        }
        const opening = withDeadline((async () => {
            const held = await openDrive(namespaced, opts.swarm, key);
            await peer(held);
            return held;
        })(), DRIVE_OPEN_TIMEOUT_MS);
        drives.set(key, opening);
        opening.catch(() => drives.delete(key));
        return opening;
    }
    async function opened() {
        const settled = await Promise.allSettled(drives.values());
        return settled
            .filter((result) => result.status === 'fulfilled')
            .map(({ value }) => value);
    }
    async function startBlindPeering() {
        await Promise.all((await opened()).map(peer));
    }
    async function close() {
        const held = await opened();
        drives.clear();
        await Promise.all(held.map(async ({ drive, topic }) => {
            await topic.destroy();
            await drive.close();
        }));
    }
    return { acquire, startBlindPeering, close };
}
