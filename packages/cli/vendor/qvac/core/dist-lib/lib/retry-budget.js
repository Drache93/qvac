const DEFAULT_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60_000;
export class RetryBudget {
    _retryMs;
    _attempts = new Map();
    _readyAt = new Map();
    constructor({ retryMs = DEFAULT_RETRY_MS } = {}) {
        this._retryMs = retryMs;
    }
    ready(name, now) {
        return (this._readyAt.get(name) ?? 0) <= now;
    }
    nextDeadline(names, now) {
        let next = null;
        for (const [name, readyAt] of this._readyAt) {
            if (!names.has(name) || readyAt <= now)
                continue;
            if (next === null || readyAt < next) {
                next = readyAt;
            }
        }
        return next;
    }
    reset(name) {
        this._attempts.delete(name);
        this._readyAt.delete(name);
    }
    retain(names) {
        for (const name of this._attempts.keys()) {
            if (!names.has(name)) {
                this.reset(name);
            }
        }
    }
    fail(name, now) {
        const attempt = (this._attempts.get(name) ?? 0) + 1;
        this._attempts.set(name, attempt);
        const at = now + Math.min(this._retryMs * 2 ** (attempt - 1), MAX_RETRY_MS);
        this._readyAt.set(name, at);
        return at;
    }
}
