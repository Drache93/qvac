import { AbortController } from 'bare-abort-controller';
import { toAsyncIterable } from '../async-iterable.js';
import { nextFrame } from '../next-frame.js';
import { AbortedError } from '@qvac/harness/race-abort';
export class UploadInput {
    iterator;
    _abort = new AbortController();
    _frames;
    _source;
    _onClose = () => {
        const error = new AbortedError();
        this._abort.abort(error);
        this.fail(error);
    };
    onData = null;
    onFailure = null;
    constructor(frames, options) {
        this._frames = frames;
        const source = toAsyncIterable(frames)[Symbol.asyncIterator]();
        this._source = source;
        this.iterator = {
            next: async () => {
                this.check();
                const frame = await nextFrame(source, { ...options, signal: this._abort.signal });
                if (!frame.done && frame.value.data) {
                    this.onData?.(frame.value.data.length);
                }
                return frame;
            }
        };
        if ('writeStream' in frames) {
            frames.writeStream?.on('close', this._onClose);
        }
    }
    check() {
        if (this._abort.signal.aborted)
            throw new AbortedError();
        if ('writeStream' in this._frames) {
            const stream = this._frames.writeStream;
            if (stream?.destroyed || stream?.destroying) {
                throw new AbortedError();
            }
        }
    }
    fail(error) {
        this.onFailure?.(error);
        this.onFailure = null;
    }
    close() {
        this.fail(new AbortedError());
        if ('writeStream' in this._frames) {
            this._frames.writeStream?.off('close', this._onClose);
        }
        void this._source.return?.().catch(noop);
    }
}
function noop() { }
