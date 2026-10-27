export const STEERED = 'steered';
export class RunInputQueue {
    _items = [];
    _wake = null;
    _closed = false;
    push(input) {
        if (this._closed) {
            return;
        }
        this._items.push(input);
        this._wake?.();
    }
    close() {
        this._closed = true;
        this._wake?.();
    }
    async *[Symbol.asyncIterator]() {
        while (true) {
            const next = this._items.shift();
            if (next) {
                yield next;
                continue;
            }
            if (this._closed) {
                return;
            }
            await new Promise((resolve) => {
                this._wake = resolve;
            });
            this._wake = null;
        }
    }
}
