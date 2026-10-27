import b4a from 'b4a';
import EventEmitter from 'bare-events';
import { sweepUnreferenced } from './sweep.js';
import { inlineReference } from './inline.js';
import { clearBlob, compactBlobCores, stringifyBlobId, writeBlob } from './blob.js';
import { parseBlobReference, readBlobReference, readBlobReferenceBytes, downloadBlobReference } from './reference.js';
export { CoreBlobServer } from './server.js';
export { compareBlobReferences, isInvalidBlobReferenceError, isPendingBlobReference, parseBlobReference, parseBlobReferenceCoreKey } from './reference.js';
export { PENDING_BLOB_REFERENCE } from './reference.js';
export { MAX_INLINE_BYTES, MAX_REFERENCE_CHARS } from './inline.js';
export class BlobStore extends EventEmitter {
    blobs;
    log;
    openBlobs;
    _readers = new Map();
    _updated = () => this.emit('update');
    _closed = false;
    constructor(host) {
        super();
        this.blobs = host.blobs;
        this.log = host.log;
        this.openBlobs = (key) => host.openBlobs(key);
        this.blobs.core.on('download', this._updated);
    }
    write(chunks, options = {}) {
        return writeBlob(this.blobs, chunks, options);
    }
    async put(bytes) {
        const blobRef = await this.blobs.put(bytes);
        return { blobRef, reference: stringifyBlobId(this.blobs, blobRef) };
    }
    reference(id) {
        return stringifyBlobId(this.blobs, id);
    }
    inline(bytes, mimeType) {
        return inlineReference(bytes, mimeType);
    }
    read(reference, options = {}) {
        return readBlobReference(this, reference, options);
    }
    readBytes(reference, options = {}) {
        return readBlobReferenceBytes(this, reference, options);
    }
    download(reference, options) {
        return downloadBlobReference(this, reference, options);
    }
    clear(reference, id) {
        return clearBlob(this, reference, id);
    }
    async compact(coreKeys) {
        if (this._closed)
            return;
        await compactBlobCores(this, coreKeys);
    }
    async available(reference) {
        if (this._closed)
            return false;
        try {
            const { blobId, coreKey, inline } = parseBlobReference(reference);
            if (inline) {
                return true;
            }
            let blobs = this.blobs;
            if (coreKey && coreKey !== b4a.toHex(blobs.core.key)) {
                let reader = this._readers.get(coreKey);
                if (!reader) {
                    reader = this.openBlobs(b4a.from(coreKey, 'hex')).then((remote) => {
                        remote.core.on('download', this._updated);
                        return remote;
                    });
                    void reader.catch(() => this._readers.delete(coreKey));
                    this._readers.set(coreKey, reader);
                }
                blobs = await reader;
            }
            return await blobs.core.has(blobId.blockOffset, blobId.blockOffset + blobId.blockLength);
        }
        catch {
            return false;
        }
    }
    sweep(references, coreLength) {
        return sweepUnreferenced(this.blobs, references, coreLength);
    }
    async close() {
        this._closed = true;
        this.blobs.core.off('download', this._updated);
        this.removeAllListeners();
        for (const reader of await Promise.allSettled(this._readers.values())) {
            if (reader.status !== 'fulfilled')
                continue;
            reader.value.core.off('download', this._updated);
            await reader.value.close();
        }
        this._readers.clear();
    }
}
