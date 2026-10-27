import { isInvalidBlobReferenceError, isPendingBlobReference, compareBlobReferences } from '../store/index.js';
import { AbortController } from 'bare-abort-controller';
import { AbortedError } from '@qvac/harness/race-abort';
const BLOB_RETRY_MS = 30_000;
export class IndexingSource {
    _readBytes;
    _log;
    _retryMs;
    _download;
    _downloads = new Map();
    retry;
    constructor(readBytes, opts) {
        this._readBytes = readBytes;
        this._log = opts.log;
        this._retryMs = opts.retryMs ?? BLOB_RETRY_MS;
        this.retry = opts.retries;
        this._download = opts.download;
    }
    retryBlockedUntil(id, now) {
        return this.retry.blockedUntil(id, now);
    }
    retryMiss(id, now) {
        return this.retry.miss(id, now, this._retryMs);
    }
    retryClear(id) {
        this.retry.clear(id);
    }
    reconnect(onRetry) {
        return this.retry.reconnect(onRetry);
    }
    async read(id, blobRef, signal) {
        if (isPendingBlobReference(blobRef)) {
            return { kind: 'missing', retryAt: Date.now() + this._retryMs };
        }
        try {
            const bytes = await this._readBytes(blobRef, { signal, wait: !this._download });
            this.retry.markFound(id);
            return { kind: 'bytes', bytes };
        }
        catch (err) {
            if (signal?.aborted || err instanceof AbortedError) {
                throw new AbortedError();
            }
            if (isInvalidBlobReferenceError(err)) {
                this._log?.warn('rag', 'blob ref is malformed, never readable', { id });
                return { kind: 'malformed' };
            }
            this._log?.debug('rag', 'blob bytes unavailable', { id, err });
            this.retry.markMissing(id);
            const retryAt = this.retryMiss(id, Date.now());
            this._fetch(id, blobRef);
            return { kind: 'missing', retryAt };
        }
    }
    async cancel(matches = () => true) {
        const pending = [];
        for (const [id, transfer] of this._downloads) {
            if (!matches(id))
                continue;
            transfer.abort.abort(new AbortedError());
            this.retryClear(id);
            pending.push(transfer.done);
        }
        await Promise.all(pending);
    }
    pending(matches) {
        for (const id of this._downloads.keys()) {
            if (matches(id))
                return true;
        }
        return false;
    }
    _fetch(id, reference) {
        const download = this._download;
        if (!download) {
            return;
        }
        const current = this._downloads.get(id);
        if (current && compareBlobReferences(current.reference, reference)) {
            return;
        }
        current?.abort.abort(new AbortedError());
        const abort = new AbortController();
        const transfer = {
            reference,
            abort,
            done: download
                .fetch(reference, { signal: abort.signal })
                .then(() => {
                if (abort.signal.aborted)
                    return;
                this.retryClear(id);
                download.ready(id);
            }, (err) => {
                if (!abort.signal.aborted) {
                    this._log?.debug('rag', 'blob download interrupted', { id, err });
                }
            })
                .finally(() => {
                if (this._downloads.get(id) === transfer) {
                    this._downloads.delete(id);
                }
            })
        };
        this._downloads.set(id, transfer);
    }
}
