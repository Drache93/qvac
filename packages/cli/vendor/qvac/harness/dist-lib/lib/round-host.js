import { AbortController } from 'bare-abort-controller';
import { pushQueue } from './queue.js';
import { roundFailureWire, roundRequestFrom } from './wire.js';
export class RoundHost {
    _port;
    _out = pushQueue();
    _rounds = new Map();
    constructor(port, send) {
        this._port = port;
        void this._drain(send);
    }
    ask(callId, payload) {
        const controller = new AbortController();
        this._rounds.set(callId, controller);
        let taker = 0;
        const emitter = (generation) => (event) => {
            if (generation !== taker || !this._rounds.has(callId))
                return;
            void this._out.push({ type: 'model-round-chunk', callId, payload: event });
        };
        const retake = () => {
            if (!this._rounds.has(callId))
                return noop;
            void this._out.push({ type: 'model-round-retake', callId });
            return emitter(++taker);
        };
        void Promise.resolve()
            .then(() => this._port(roundRequestFrom(payload), {
            signal: controller.signal,
            emit: emitter(0),
            retake
        }))
            .then((result) => this._settle(callId, { result }), (err) => this._settle(callId, roundFailureWire(err)));
    }
    cancel(callId) {
        this._rounds.get(callId)?.abort(undefined);
        this._rounds.delete(callId);
    }
    close() {
        for (const callId of [...this._rounds.keys()]) {
            this.cancel(callId);
        }
        this._out.end();
    }
    _settle(callId, frame) {
        if (this._rounds.delete(callId)) {
            void this._out.push({ type: 'model-round-result', callId, ...frame });
        }
    }
    async _drain(send) {
        for await (const frame of this._out) {
            send(frame);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
}
function noop() { }
