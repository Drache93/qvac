import { AbortController } from 'bare-abort-controller';
import { AbortedError } from '../helpers/race-abort.js';
import { retryMemo } from '../helpers/retry-memo.js';
export class ModelHandle {
    _load;
    _peek;
    _onLoaded;
    _onFailed;
    _tracked = null;
    _loading = false;
    _resource = null;
    lastUsed = 0;
    _attempt = null;
    constructor({ load, onLoaded, onFailed }) {
        const memo = retryMemo(() => {
            const attempt = new AbortController();
            this._attempt = attempt;
            return load(attempt.signal);
        });
        this._load = memo;
        this._peek = memo.peek;
        this._onLoaded = onLoaded;
        this._onFailed = onFailed;
        this.load().catch(noop);
    }
    load() {
        const attempt = this._load();
        if (attempt !== this._tracked) {
            this._tracked = attempt;
            this._loading = true;
            const settle = (report) => {
                if (this._tracked === attempt) {
                    this._loading = false;
                    report();
                }
            };
            attempt.then((resource) => settle(() => {
                this._resource = resource;
                this._onLoaded?.();
            }), (err) => settle(() => this._onFailed?.(err)));
        }
        return attempt;
    }
    get loading() {
        return this._loading;
    }
    abandon() {
        this._attempt?.abort(new AbortedError());
    }
    peek() {
        return this._peek();
    }
    get resource() {
        return this._loading ? null : this._resource;
    }
}
function noop() { }
