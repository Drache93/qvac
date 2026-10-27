import { unref } from './unref.js';
export class DeadlineScheduler {
    _onFire;
    _timer = null;
    _at = null;
    constructor(onFire) {
        this._onFire = onFire;
    }
    get at() {
        return this._at;
    }
    schedule(deadline) {
        const at = deadline + 1;
        if (this._at !== null && this._at <= at) {
            return;
        }
        this.clear();
        this._at = at;
        this._timer = setTimeout(() => {
            this._timer = null;
            this._at = null;
            this._onFire();
        }, Math.max(0, at - Date.now()));
        unref(this._timer);
    }
    clear() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
        this._timer = null;
        this._at = null;
    }
}
