export class TextCoalescer {
    _write;
    _cap;
    _holdMs;
    _buffered = null;
    _hold = null;
    constructor(write, { cap = 8192, holdMs = 60 } = {}) {
        this._write = write;
        this._cap = cap;
        this._holdMs = holdMs;
    }
    async add(type, text) {
        if (this._buffered && this._buffered.type !== type) {
            await this.flush();
        }
        if (!this._buffered) {
            this._buffered = { type, text: '' };
            this._hold = setTimeout(() => void this.flush(), this._holdMs);
        }
        this._buffered.text += text;
        if (this._buffered.text.length >= this._cap) {
            await this.flush();
        }
    }
    flush() {
        if (this._hold) {
            clearTimeout(this._hold);
            this._hold = null;
        }
        if (!this._buffered) {
            return Promise.resolve();
        }
        const { type, text } = this._buffered;
        this._buffered = null;
        return this._write(type, text);
    }
}
