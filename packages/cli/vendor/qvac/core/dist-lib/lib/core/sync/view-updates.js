import b4a from 'b4a';
export class ViewUpdates {
    _run;
    _pending;
    _next = null;
    _running = null;
    _kept = null;
    _started = false;
    _closed = false;
    constructor(run, pending = null) {
        this._run = run;
        this._pending = pending;
    }
    async start() {
        try {
            const resumed = await this._pending?.read();
            if (this._closed) {
                return;
            }
            if (resumed) {
                this._kept = resumed;
                this._queue(resumed, { older: true });
            }
            if (this._next) {
                await this._keep(this._next.update);
            }
        }
        finally {
            this._started = true;
            this._kick();
        }
    }
    push(update) {
        const next = this._queue(update);
        if (!this._started) {
            return Promise.resolve();
        }
        const running = this._running && !this._running.done ? this._running : null;
        const written = this._keep(running ? merged(running.update, next) : next);
        this._kick();
        return written;
    }
    close() {
        this._closed = true;
        this._running?.settle();
        this._next?.settle();
    }
    flush() {
        return (this._next ?? this._running)?.synced ?? Promise.resolve();
    }
    _kick() {
        if (this._started && !this._closed && this._next && !this._running) {
            void this._drain();
        }
    }
    async _drain() {
        try {
            while (this._next) {
                this._running = this._next;
                this._next = null;
                const reached = await this._run(this._running.update);
                if (this._closed) {
                    return;
                }
                this._running.done = true;
                await this._keepNext(reached || null);
                this._running.settle();
                this._running = null;
            }
        }
        finally {
            this._running = null;
        }
    }
    _queue(update, { older = false } = {}) {
        if (!this._next) {
            this._next = pass(update);
        }
        else {
            const queued = this._next.update;
            this._next.update = older ? merged(update, queued) : merged(queued, update);
        }
        return this._next.update;
    }
    _keepNext(reached) {
        if (!this._next) {
            return this._clear();
        }
        if (reached) {
            this._next.update = rebased(this._next.update, reached);
        }
        return this._keep(this._next.update);
    }
    _keep(update) {
        if (!this._pending || (this._kept && sameUpdate(this._kept, update))) {
            return Promise.resolve();
        }
        this._kept = update;
        return this._pending.write(update);
    }
    _clear() {
        if (!this._pending || !this._kept) {
            return Promise.resolve();
        }
        this._kept = null;
        return this._pending.clear();
    }
}
function pass(update) {
    let settle = () => { };
    const synced = new Promise((resolve) => (settle = resolve));
    return { update, done: false, synced, settle };
}
function merged(pending, next) {
    return {
        from: pending.from,
        to: next.to,
        incremental: pending.incremental && next.incremental
    };
}
function rebased(update, reached) {
    const { from } = update;
    if (!update.incremental || !from || !b4a.equals(from.key, reached.key)) {
        return update;
    }
    return reached.length > from.length ? { ...update, from: reached } : update;
}
function sameUpdate(a, b) {
    return a.incremental === b.incremental && sameHead(a.from, b.from);
}
function sameHead(a, b) {
    return a && b ? a.length === b.length && b4a.equals(a.key, b.key) : a === b;
}
