import ScopeLock from 'scope-lock';
export class WriteQueue {
    _scopes = new Map();
    _slowMs;
    _onSlow;
    constructor({ slowMs = 5000, onSlow } = {}) {
        this._slowMs = slowMs;
        this._onSlow = onSlow;
    }
    async run(name, write, task) {
        const scope = this._enter(name);
        await scope.lock.lock();
        const slow = setTimeout(() => {
            this._onSlow?.({ scope: name, write, waiting: scope.waiting, afterMs: this._slowMs });
        }, this._slowMs);
        try {
            return await task();
        }
        finally {
            clearTimeout(slow);
            scope.lock.unlock();
            this._leave(name, scope);
        }
    }
    pending() {
        return [...this._scopes].map(([name, scope]) => ({ scope: name, waiting: scope.waiting }));
    }
    _enter(name) {
        const scope = this._scopes.get(name) ?? { lock: new ScopeLock(), waiting: 0 };
        scope.waiting++;
        this._scopes.set(name, scope);
        return scope;
    }
    _leave(name, scope) {
        scope.waiting--;
        if (scope.waiting === 0 && this._scopes.get(name) === scope) {
            this._scopes.delete(name);
        }
    }
}
