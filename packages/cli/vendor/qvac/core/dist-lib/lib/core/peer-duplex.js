import b4a from 'b4a';
import { raw, uint } from 'compact-encoding';
import { Duplex } from 'streamx';
import { createProtocolPairing } from './protocol-pairing.js';
function noop() { }
const bytes = raw;
const frame = {
    preencode(state, f) {
        uint.preencode(state, f.id);
        uint.preencode(state, f.mine ? 1 : 0);
        bytes.preencode(state, f.data);
    },
    encode(state, f) {
        uint.encode(state, f.id);
        uint.encode(state, f.mine ? 1 : 0);
        bytes.encode(state, f.data);
    },
    decode(state) {
        const id = uint.decode(state);
        const mine = uint.decode(state) === 1;
        return { id, mine, data: bytes.decode(state) };
    }
};
const ends = {
    preencode(state, e) {
        uint.preencode(state, e.id);
        uint.preencode(state, e.mine ? 1 : 0);
    },
    encode(state, e) {
        uint.encode(state, e.id);
        uint.encode(state, e.mine ? 1 : 0);
    },
    decode(state) {
        return { id: uint.decode(state), mine: uint.decode(state) === 1 };
    }
};
export class PeerDuplexChannel {
    _opts;
    _peers;
    _nextId;
    _pairing;
    constructor(opts) {
        this._opts = opts;
        this._peers = new Map();
        this._nextId = 1;
        this._pairing = createProtocolPairing(opts.protocol);
    }
    addStream(stream) {
        const deviceId = b4a.toHex(stream.remotePublicKey);
        if (this._peers.has(deviceId)) {
            return;
        }
        const channel = this._pairing
            .mux(stream, () => this.addStream(stream))
            .createChannel({
            protocol: this._opts.protocol,
            onopen: () => this._opened(deviceId),
            onclose: () => this._drop(deviceId)
        });
        if (!channel) {
            return;
        }
        const open = channel.addMessage({
            encoding: uint,
            onmessage: (id) => void this._serve(deviceId, id)
        });
        const data = channel.addMessage({
            encoding: frame,
            onmessage: (f) => this._deliver(deviceId, f)
        });
        const close = channel.addMessage({
            encoding: ends,
            onmessage: (e) => this._end(deviceId, e)
        });
        this._peers.set(deviceId, {
            channel,
            remoteKey: stream.remotePublicKey,
            open,
            data,
            close,
            dialled: new Map(),
            served: new Map(),
            opened: false
        });
        channel.open();
    }
    openIds() {
        return [...this._peers].filter(([, peer]) => peer.opened).map(([deviceId]) => deviceId);
    }
    isOpen(deviceId) {
        return this._peers.get(deviceId)?.opened === true;
    }
    closeDialled(deviceId, reason) {
        for (const stream of [...(this._peers.get(deviceId)?.dialled.values() ?? [])]) {
            stream.destroy(reason());
        }
    }
    dial(deviceId) {
        const peer = this._peers.get(deviceId);
        if (!peer) {
            throw this._opts.unreachable();
        }
        const id = this._nextId;
        this._nextId += 1;
        const stream = this._attach(peer, id, { mine: true });
        peer.open.send(id);
        return stream;
    }
    async revalidate(allowed) {
        for (const peer of [...this._peers.values()]) {
            if (peer.served.size === 0)
                continue;
            if (await allowed(peer.remoteKey).catch(() => false))
                continue;
            for (const [id, stream] of [...peer.served]) {
                peer.served.delete(id);
                peer.close.send({ id, mine: false });
                stream.destroy(this._opts.revoked());
            }
        }
    }
    destroy() {
        this._pairing.destroy();
        for (const [deviceId, peer] of [...this._peers]) {
            try {
                peer.channel.close();
            }
            catch { }
            this._drop(deviceId);
        }
    }
    _opened(deviceId) {
        const peer = this._peers.get(deviceId);
        if (!peer) {
            return;
        }
        peer.opened = true;
        this._opts.onchange?.(deviceId);
    }
    _attach(peer, id, opts) {
        const { mine } = opts;
        const held = mine ? peer.dialled : peer.served;
        const stream = new Duplex({
            write: (chunk, cb) => {
                peer.data.send({ id, mine, data: chunk });
                cb(null);
            },
            final: (cb) => {
                peer.close.send({ id, mine });
                cb(null);
            },
            destroy: (cb) => {
                if (held.delete(id)) {
                    peer.close.send({ id, mine });
                }
                cb(null);
            }
        });
        held.set(id, stream);
        return stream;
    }
    async _serve(deviceId, id) {
        const peer = this._peers.get(deviceId);
        if (!peer || peer.served.has(id)) {
            return;
        }
        const stream = this._attach(peer, id, { mine: false });
        stream.on('error', noop);
        const served = await this._opts.onaccept(peer.remoteKey).catch(noop);
        if (!served || peer.served.get(id) !== stream) {
            served?.destroy();
            stream.destroy();
            return;
        }
        served.on('error', noop);
        stream.pipe(served).pipe(stream);
    }
    _deliver(deviceId, f) {
        const peer = this._peers.get(deviceId);
        if (!peer) {
            return;
        }
        const held = f.mine ? peer.served : peer.dialled;
        held.get(f.id)?.push(f.data);
    }
    _end(deviceId, e) {
        const peer = this._peers.get(deviceId);
        if (!peer) {
            return;
        }
        const held = e.mine ? peer.served : peer.dialled;
        const stream = held.get(e.id);
        if (!stream) {
            return;
        }
        held.delete(e.id);
        stream.push(null);
        stream.destroy();
    }
    _drop(deviceId) {
        const peer = this._peers.get(deviceId);
        if (!peer) {
            return;
        }
        this._peers.delete(deviceId);
        for (const held of [peer.dialled, peer.served]) {
            for (const stream of held.values()) {
                stream.destroy(this._opts.unreachable());
            }
            held.clear();
        }
        if (peer.opened) {
            this._opts.onchange?.(deviceId);
        }
    }
}
