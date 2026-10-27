import b4a from 'b4a';
import { settleOnClose } from '@qvac/harness/rpc';
import { duplexPair } from '@qvac/harness/transport';
import { bindApi } from '../../spec/bind.js';
import { engineClient } from '../../spec/calls.js';
import HRPC from '../../spec/hrpc/index.js';
import { PeerDuplexChannel } from './peer-duplex.js';
import { CoreError } from '../errors.js';
const PROTOCOL = 'qvac/device-control';
export class DeviceControl {
    _opts;
    _channel;
    _engines;
    _ours;
    _checks;
    constructor(opts) {
        this._opts = opts;
        this._channel = new PeerDuplexChannel({
            protocol: PROTOCOL,
            onaccept: (from) => this._accept(from),
            unreachable: () => new CoreError('DEVICE_UNREACHABLE'),
            revoked: () => new CoreError('DEVICE_REVOKED'),
            onchange: (deviceId) => this._changed(deviceId)
        });
        this._engines = new Map();
        this._ours = new Set();
        this._checks = new Map();
    }
    addStream(stream) {
        this._channel.addStream(stream);
    }
    engine(deviceId) {
        const id = b4a.toHex(deviceId);
        if (!this._ours.has(id)) {
            throw new CoreError('DEVICE_UNREACHABLE');
        }
        const held = this._engines.get(id);
        if (held) {
            return held;
        }
        const stream = this._channel.dial(id);
        const engine = engineClient(settleOnClose(new HRPC(stream)));
        stream.once('close', () => {
            if (this._engines.get(id) === engine) {
                this._engines.delete(id);
            }
        });
        this._engines.set(id, engine);
        return engine;
    }
    async revalidate() {
        await this._channel.revalidate(this._opts.allowed);
        await Promise.all(this._channel.openIds().map((id) => this._recheck(id)));
    }
    destroy() {
        this._channel.destroy();
        this._engines.clear();
    }
    async _accept(from) {
        const handlers = this._opts.served();
        if (!handlers || !(await this._opts.allowed(from))) {
            return null;
        }
        const [ours, theirs] = duplexPair();
        bindApi(settleOnClose(new HRPC(ours)), handlers);
        return theirs;
    }
    _changed(deviceId) {
        if (this._channel.isOpen(deviceId)) {
            void this._recheck(deviceId);
            return;
        }
        this._ours.delete(deviceId);
        this._engines.delete(deviceId);
    }
    async _recheck(deviceId) {
        const check = (this._checks.get(deviceId) ?? 0) + 1;
        this._checks.set(deviceId, check);
        const allowed = await this._opts.allowed(b4a.from(deviceId, 'hex')).catch(() => false);
        if (this._checks.get(deviceId) !== check) {
            return;
        }
        if (allowed && this._channel.isOpen(deviceId)) {
            this._ours.add(deviceId);
            return;
        }
        this._ours.delete(deviceId);
        this._engines.delete(deviceId);
        this._channel.closeDialled(deviceId, () => new CoreError('DEVICE_REVOKED'));
    }
}
