import { decode, encode } from '../spec/hyperschema/index.js';
import { snapshotEquals } from './api/watchable.js';
class ModelsWatch {
    _catalog;
    _read;
    _revisions = null;
    _opening = null;
    _closed = false;
    _last = null;
    constructor(catalog, read) {
        this._catalog = catalog;
        this._read = read;
    }
    async next() {
        this._opening ??= this._open();
        const revisions = await this._opening;
        while (revisions && !this._closed && !(await revisions.next()).done) {
            const list = this._closed ? null : await this._read();
            if (list === null || this._closed || snapshotEquals(list, this._last)) {
                continue;
            }
            this._last = list;
            return { value: list, done: false };
        }
        return { value: undefined, done: true };
    }
    async return() {
        this._closed = true;
        await this._revisions?.return?.();
        return { value: undefined, done: true };
    }
    async _open() {
        this._revisions = (await this._catalog())?.[Symbol.asyncIterator]() ?? null;
        if (this._closed) {
            await this._revisions?.return?.();
        }
        return this._revisions;
    }
}
export function watchModels(catalog, read) {
    return { [Symbol.asyncIterator]: () => new ModelsWatch(catalog, read) };
}
export function asEncoded(models) {
    return models.map((model) => decode('@assistant/model-info', encode('@assistant/model-info', model)));
}
