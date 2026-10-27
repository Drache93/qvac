export class LogBuffer {
    _items;
    _cap;
    constructor(cap) {
        this._items = [];
        this._cap = cap;
    }
    push(item) {
        this._items.push(item);
        if (this._items.length > this._cap) {
            this._items.shift();
        }
    }
    snapshot() {
        return [...this._items];
    }
}
