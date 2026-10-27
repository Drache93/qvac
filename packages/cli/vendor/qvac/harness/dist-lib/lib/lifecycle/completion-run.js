import { AbortController } from 'bare-abort-controller';
import { raceDrain } from '../helpers/drain.js';
export function trackCompletion(createSource, signal, onFinish) {
    const controller = new AbortController();
    const abort = () => {
        if (!controller.signal.aborted) {
            controller.abort(undefined);
        }
    };
    const onAbort = () => abort();
    if (signal?.aborted) {
        abort();
    }
    else {
        signal?.addEventListener('abort', onAbort);
    }
    let started = false;
    const source = createSource(controller.signal);
    let settled = false;
    let run;
    const finish = () => {
        if (settled) {
            return;
        }
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        onFinish(run);
    };
    const iterator = new TrackedCompletionIterator({
        source,
        start: () => {
            started = true;
        },
        finish,
        abort
    });
    run = {
        abort,
        get started() {
            return started;
        },
        close: async () => {
            abort();
            await raceDrain(iterator.return());
        }
    };
    return { iterator, run };
}
class TrackedCompletionIterator {
    _source;
    _start;
    _finish;
    _abort;
    _started = false;
    _closed = false;
    _returnResult = null;
    constructor({ source, start, finish, abort }) {
        this._source = source;
        this._start = start;
        this._finish = finish;
        this._abort = abort;
    }
    [Symbol.asyncIterator]() {
        return this;
    }
    [Symbol.asyncDispose]() {
        return this.return().then(() => { });
    }
    next(value) {
        if (this._closed) {
            return Promise.resolve({ done: true, value: undefined });
        }
        this._started = true;
        this._start();
        return this._source.next(value).then((result) => {
            if (result.done) {
                this._closed = true;
                this._finish();
            }
            return result;
        }, (error) => {
            this._closed = true;
            this._finish();
            throw error;
        });
    }
    return(value) {
        if (this._returnResult) {
            return this._returnResult;
        }
        this._closed = true;
        this._abort();
        if (!this._started) {
            this._finish();
            this._returnResult = Promise.resolve({ done: true, value });
            return this._returnResult;
        }
        this._returnResult = this._source.return(value).then((result) => {
            this._finish();
            return result;
        }, (error) => {
            this._finish();
            throw error;
        });
        return this._returnResult;
    }
    throw(error) {
        if (this._closed) {
            return Promise.reject(error);
        }
        this._abort();
        this._started = true;
        this._start();
        return this._source.throw(error).then((result) => {
            if (result.done) {
                this._closed = true;
                this._finish();
            }
            return result;
        }, (reason) => {
            this._closed = true;
            this._finish();
            throw reason;
        });
    }
}
