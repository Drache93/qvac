import ScopeLock from 'scope-lock';
import { Mesh } from './mesh.js';
import b4a from 'b4a';
const SCOPE = ['p2p', 'departure'];
export class PendingDepartures {
    _store;
    _local;
    _swarm;
    _log;
    _blindPeerKeys;
    _wakeup;
    _isPooled;
    _deviceId;
    _delivered;
    _active = new Map();
    _parked = new Set();
    _lock = new ScopeLock();
    _closing = false;
    _blindPeering;
    constructor(store, local, opts) {
        this._store = store;
        this._local = local;
        this._swarm = opts.swarm;
        this._isPooled = opts.isPooled;
        this._deviceId = opts.deviceId;
        this._delivered = opts.delivered ?? noop;
        this._log = opts.logger ?? null;
        this._blindPeerKeys = opts.blindPeerKeys ?? [];
        this._wakeup = opts.wakeup;
        this._blindPeering = opts.blindPeering;
    }
    flush() {
        void this._flush().catch((err) => this._log?.warn(SCOPE, 'departure flush failed', err));
    }
    async _flush() {
        await this._lock.lock();
        try {
            if (this._closing) {
                return;
            }
            for (const row of await this._local.departures()) {
                if (this._closing)
                    return;
                const hex = b4a.toHex(row.key);
                if (this._isPooled(row.key) || this._parked.has(hex) || this._active.has(hex)) {
                    continue;
                }
                const mesh = new Mesh(this._store, {
                    seed: row.seed,
                    key: row.creator ? null : row.key,
                    role: await this._local.departureRole(row),
                    writerSeed: row.writerSeed ?? undefined,
                    deviceId: this._deviceId() ?? undefined,
                    logger: this._log,
                    blindPeerKeys: this._blindPeerKeys,
                    wakeup: this._wakeup
                });
                const done = this._deliver(row, mesh)
                    .catch((err) => this._log?.warn(SCOPE, 'departure delivery failed', err))
                    .finally(() => this._active.delete(hex));
                this._active.set(hex, { mesh, done });
            }
        }
        finally {
            this._lock.unlock();
        }
    }
    async _deliver(row, mesh) {
        const scope = [...SCOPE, b4a.toHex(row.key).slice(0, 8)];
        let delivered = false;
        try {
            await mesh.ready();
            if (this._closing || mesh.closing) {
                return;
            }
            this._swarm.join(mesh.discoveryKey, { server: true, client: true });
            const peering = this._blindPeering();
            if (peering) {
                mesh.startBlindPeering(peering);
            }
            this._log?.info(scope, 'reopened a departed mesh to deliver its removal');
            const announced = await this._announce(mesh);
            if (announced === 'closed' || (announced === 'sent' && !(await waitForDelivery(mesh)))) {
                return;
            }
            await this._local.deleteDeparture(row.key);
            delivered = true;
            this._log?.info(scope, 'departure delivered');
        }
        finally {
            await this._swarm.leave(mesh.discoveryKey).catch(noop);
            await mesh.close().catch(noop);
        }
        if (delivered) {
            this._delivered(row.key);
        }
    }
    async _announce(mesh) {
        if (mesh.localLength === 0)
            return 'moot';
        const deviceId = this._deviceId();
        if (!deviceId || (await mesh.checkResumedRevocation())) {
            return 'sent';
        }
        if (!(await admitted(mesh))) {
            return mesh.closing ? 'closed' : 'moot';
        }
        await mesh.dispatch('remove-writer', {
            writerKey: mesh.localWriterKey,
            deviceId,
            revokedAt: Date.now()
        });
        return 'sent';
    }
    async park(key) {
        const hex = b4a.toHex(key);
        await this._lock.lock();
        try {
            this._parked.add(hex);
            const entry = this._active.get(hex);
            if (!entry) {
                return;
            }
            await entry.mesh.close().catch(noop);
            await entry.done;
        }
        finally {
            this._lock.unlock();
        }
    }
    unpark(key) {
        this._parked.delete(b4a.toHex(key));
    }
    drop(key) {
        return this._local.deleteDeparture(key);
    }
    startBlindPeering() {
        const peering = this._blindPeering();
        if (!peering) {
            return;
        }
        for (const { mesh } of this._active.values()) {
            mesh.startBlindPeering(peering);
        }
    }
    stopBlindPeering() {
        for (const { mesh } of this._active.values()) {
            mesh.stopBlindPeering();
        }
    }
    async suspend() {
        for (const { mesh } of this._active.values()) {
            await mesh.suspend();
        }
    }
    async resume() {
        for (const { mesh } of this._active.values()) {
            await mesh.resume();
        }
    }
    async close() {
        this._closing = true;
        await Promise.all([...this._active.values()].map(async ({ mesh, done }) => {
            await mesh.close().catch(noop);
            await done;
        }));
    }
}
async function admitted(mesh) {
    if (mesh.writable)
        return true;
    if (await mesh.ownWriterRefused())
        return false;
    if (mesh.closing) {
        return false;
    }
    return new Promise((resolve) => {
        const settle = (ok) => {
            mesh.autobee.off('writable', onWritable);
            mesh.syncActivity.unwatch(check);
            mesh.off('close', onClose);
            resolve(ok);
        };
        const onWritable = () => settle(true);
        const onClose = () => settle(false);
        const check = () => {
            void mesh.ownWriterRefused().then((refused) => refused && settle(false), noop);
        };
        mesh.autobee.on('writable', onWritable);
        mesh.syncActivity.watch(check);
        mesh.on('close', onClose);
    });
}
export function waitForDelivery(mesh) {
    const local = mesh.autobee.local;
    let uploaded = 0;
    const delivered = () => local.length > 0 &&
        (uploaded >= local.length || local.peers.some((peer) => peer.remoteLength >= local.length));
    if (delivered()) {
        return Promise.resolve(true);
    }
    if (mesh.closing) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        const settle = (ok) => {
            local.off('upload', onUpload);
            local.off('peer-add', check);
            mesh.syncActivity.unwatch(check);
            mesh.off('close', onClose);
            resolve(ok);
        };
        const check = () => {
            if (delivered()) {
                settle(true);
            }
        };
        const onUpload = (index) => {
            uploaded = Math.max(uploaded, index + 1);
            check();
        };
        const onClose = () => settle(false);
        local.on('upload', onUpload);
        local.on('peer-add', check);
        mesh.syncActivity.watch(check);
        mesh.on('close', onClose);
    });
}
function noop() { }
