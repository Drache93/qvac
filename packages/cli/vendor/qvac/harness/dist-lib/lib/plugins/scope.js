export class Scope {
    _name;
    _disposers = [];
    _releases = [];
    _sealed = false;
    _disposed = false;
    _closing = null;
    constructor(name) {
        this._name = name;
    }
    assertOpen() {
        if (this._sealed) {
            throw new Error(`Scope "${this._name}" no longer accepts registrations`);
        }
    }
    assertActive() {
        if (this._disposed) {
            throw new Error(`Scope "${this._name}" has been disposed`);
        }
    }
    onDispose(dispose) {
        this.assertOpen();
        this._disposers.push(dispose);
    }
    onRelease(dispose) {
        this.assertOpen();
        this._releases.push(dispose);
    }
    seal() {
        this._sealed = true;
    }
    close() {
        this.seal();
        this._closing ??= Promise.resolve().then(() => this._dispose());
        return this._closing;
    }
    async _dispose() {
        const errors = [];
        for (const disposers of [this._disposers, this._releases]) {
            for (const dispose of disposers.reverse()) {
                try {
                    await dispose();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            disposers.length = 0;
        }
        this._disposed = true;
        if (errors.length) {
            throw new AggregateError(errors, `Cleanup failed for "${this._name}"`);
        }
    }
}
