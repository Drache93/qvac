import BlobServer, {} from 'hypercore-blob-server';
import ReadyResource from 'ready-resource';
import { isInvalidBlobReferenceError, parseBlobReference } from './reference.js';
import b4a from 'b4a';
export class CoreBlobServer extends ReadyResource {
    _store;
    _mesh;
    _server;
    _probes = new Set();
    _readTimeoutMs;
    _onRead;
    _suspended = false;
    constructor(store, mesh, { readTimeoutMs = 15_000, onRead = null } = {}) {
        super();
        this._store = store.session();
        this._mesh = mesh;
        this._readTimeoutMs = readTimeoutMs;
        this._onRead = onRead;
        this._server = new BlobServer(this._store, {
            resolve: (key, info) => this._resolve(key, info)
        });
    }
    get port() {
        return this._server.port;
    }
    link({ blobId, mimeType }, source) {
        if (!this.opened || this.closing)
            return null;
        const parsed = this._parse(blobId);
        if (!parsed || parsed.inline) {
            return null;
        }
        return this._server.getLink(parsed.coreKey ?? b4a.toHex(source.blobs.core.key), {
            blob: parsed.blobId,
            drive: source.key,
            type: mimeType || 'application/octet-stream'
        });
    }
    async suspend() {
        if (this.closing)
            return;
        this._suspended = true;
        if (!this.opened) {
            await this.ready();
        }
        await Promise.all([...this._probes].map((core) => core.close()));
        await this._server.suspend();
    }
    async resume() {
        if (this.closing)
            return;
        if (!this.opened)
            await this.ready();
        if (this.closing) {
            return;
        }
        this._suspended = false;
        const before = this._server.port;
        await this._server.resume();
        if (this._server.port !== before) {
            this.emit('rebound', this._server.port);
        }
    }
    async _open() {
        await this._server.listen();
    }
    async _close() {
        await Promise.all([...this._probes].map((core) => core.close()));
        await this._server.close();
        await this._store.close();
    }
    async _resolve(key, info) {
        const { blob, range } = info;
        const meshKey = info.drive ?? undefined;
        const current = await this._mesh(b4a.toHex(key), blob?.blockOffset, meshKey);
        if (!current || this.closing || this._suspended) {
            return null;
        }
        const keys = { encryptionKey: current.encryptionKey };
        if (!blob || info.head || blob.byteLength === 0) {
            return keys;
        }
        const start = range?.start ?? 0;
        const end = !range || range.end === -1 ? blob.byteLength - 1 : Math.min(range.end, blob.byteLength - 1);
        if (start > end) {
            return keys;
        }
        const core = this._store.get({ key, ...keys });
        const deadline = Date.now() + this._readTimeoutMs;
        this._probes.add(core);
        try {
            await core.ready();
            if (this.closing || this._suspended || Date.now() >= deadline) {
                return null;
            }
            const position = start === 0
                ? [blob.blockOffset, 0]
                : await core.seek(blob.byteOffset + start, {
                    timeout: Math.max(1, deadline - Date.now())
                });
            if (!position || this.closing || this._suspended || Date.now() >= deadline) {
                return null;
            }
            const bytes = await core.get(position[0], { timeout: Math.max(1, deadline - Date.now()) });
            const served = bytes &&
                (await this._mesh(b4a.toHex(key), blob.blockOffset, meshKey)) === current &&
                !this.closing &&
                !this._suspended;
            if (served) {
                this._onRead?.(current, key, blob.blockOffset);
            }
            return served ? keys : null;
        }
        catch {
            return null;
        }
        finally {
            this._probes.delete(core);
            await core.close();
        }
    }
    _parse(blobReference) {
        try {
            return parseBlobReference(blobReference);
        }
        catch (err) {
            if (isInvalidBlobReferenceError(err)) {
                return null;
            }
            throw err;
        }
    }
}
