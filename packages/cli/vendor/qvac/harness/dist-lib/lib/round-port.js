import { HarnessError } from './errors.js';
import { AbortedError } from './helpers/engine-error.js';
import { roundChunkFrom, roundResultFrom } from './wire.js';
export class RoundPort {
    _push;
    _asked = new Map();
    _calls = 0;
    _cut = null;
    _closed = false;
    constructor(push) {
        this._push = push;
    }
    port = (request, io) => {
        if (this._closed) {
            return Promise.reject(new HarnessError('CLIENT_GONE'));
        }
        if (io.signal.aborted) {
            return Promise.reject(new AbortedError());
        }
        const callId = String(this._calls++);
        return new Promise((resolve, reject) => {
            const cancel = () => {
                if (!this._take(callId))
                    return;
                this._push({ type: 'model-round-cancel', callId });
                reject(new AbortedError());
            };
            this._asked.set(callId, { io, emit: io.emit, cancel, resolve, reject });
            io.signal.addEventListener('abort', cancel, { once: true });
            this._push({ type: 'model-round-ask', callId, payload: request });
        });
    };
    roundCut = (cut) => {
        this._cut = cut;
    };
    frame(frame) {
        switch (frame.type) {
            case 'model-round-chunk':
                this._asked.get(frame.callId ?? '')?.emit(roundChunkFrom(frame.payload));
                return true;
            case 'model-round-retake':
                this._retake(frame.callId ?? '');
                return true;
            case 'model-round-result':
                this._settle(frame);
                return true;
            case 'round-cut':
                this._cut?.(frame.message ?? '');
                return true;
            default:
                return false;
        }
    }
    close() {
        this._closed = true;
        for (const callId of [...this._asked.keys()]) {
            this._take(callId)?.reject(new HarnessError('CLIENT_GONE'));
        }
    }
    _retake(callId) {
        const asked = this._asked.get(callId);
        if (asked) {
            asked.emit = asked.io.retake();
        }
    }
    _settle(frame) {
        const asked = this._take(frame.callId ?? '');
        try {
            asked?.resolve(roundResultFrom(frame));
        }
        catch (err) {
            asked?.reject(err);
        }
    }
    _take(callId) {
        const asked = this._asked.get(callId);
        this._asked.delete(callId);
        asked?.io.signal.removeEventListener('abort', asked.cancel);
        return asked;
    }
}
