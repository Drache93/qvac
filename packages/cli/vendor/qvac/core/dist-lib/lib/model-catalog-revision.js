export class ModelCatalogRevisionHub {
    _listeners = new Set();
    _revision = 0;
    _closed = false;
    notify() {
        if (this._closed)
            return;
        this._revision += 1;
        for (const listener of this._listeners) {
            listener();
        }
    }
    watch() {
        const hub = this;
        let observed = -1;
        let ended = false;
        let pending = null;
        const done = () => ({
            value: undefined,
            done: true
        });
        const onChange = () => {
            if (!pending)
                return;
            const next = pending;
            pending = null;
            if (ended || hub._closed) {
                next.resolve(done());
                return;
            }
            observed = hub._revision;
            next.resolve({ value: { revision: observed }, done: false });
        };
        hub._listeners.add(onChange);
        const iterator = {
            next() {
                if (ended || hub._closed) {
                    return Promise.resolve(done());
                }
                if (observed !== hub._revision) {
                    observed = hub._revision;
                    return Promise.resolve({ value: { revision: observed }, done: false });
                }
                pending ??= Promise.withResolvers();
                return pending.promise;
            },
            return() {
                ended = true;
                hub._listeners.delete(onChange);
                pending?.resolve(done());
                pending = null;
                return Promise.resolve(done());
            }
        };
        return {
            [Symbol.asyncIterator]: () => iterator
        };
    }
    close() {
        if (this._closed)
            return;
        this._closed = true;
        for (const listener of this._listeners) {
            listener();
        }
        this._listeners.clear();
    }
}
