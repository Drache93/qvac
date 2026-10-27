import { readBlob } from './blob.js';
import { AbortedError, raceAbort } from '@qvac/harness/race-abort';
import { MAX_REFERENCE_CHARS, readInline } from './inline.js';
import b4a from 'b4a';
import { CoreError } from '../../../errors.js';
import { isRecord } from '../../../guards.js';
import { PENDING_BLOB_REFERENCE } from '../../../constants.js';
const CORE_KEY_PATTERN = /^[0-9a-f]{64}$/;
const DEFAULT_REMOTE_TIMEOUT_MS = 15_000;
const INVALID_BLOB_REFERENCE = 'invalid blob reference';
export { PENDING_BLOB_REFERENCE };
export function isPendingBlobReference(blobReference) {
    return blobReference === PENDING_BLOB_REFERENCE;
}
function invalidBlobReference() {
    return new TypeError(INVALID_BLOB_REFERENCE);
}
export function isInvalidBlobReferenceError(error) {
    return error instanceof TypeError && error.message === INVALID_BLOB_REFERENCE;
}
function blobUnavailable(cause) {
    return new CoreError('BLOB_UNAVAILABLE', [], {
        cause: cause instanceof Error ? cause : undefined
    });
}
function parseBlobReferenceRecord(blobReference) {
    if (blobReference.length > MAX_REFERENCE_CHARS) {
        throw invalidBlobReference();
    }
    let value;
    try {
        value = JSON.parse(blobReference);
    }
    catch {
        throw invalidBlobReference();
    }
    if (!isRecord(value)) {
        throw invalidBlobReference();
    }
    return value;
}
function readCoreKey(record) {
    const coreKey = record.coreKey;
    if (coreKey !== undefined && (typeof coreKey !== 'string' || !CORE_KEY_PATTERN.test(coreKey))) {
        throw invalidBlobReference();
    }
    return coreKey;
}
function readOffset(record, name) {
    const value = record[name];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw invalidBlobReference();
    }
    return value;
}
export function parseBlobReferenceCoreKey(blobReference) {
    return readCoreKey(parseBlobReferenceRecord(blobReference));
}
export function parseBlobReference(blobReference) {
    const value = parseBlobReferenceRecord(blobReference);
    if (value.blockMap) {
        throw invalidBlobReference();
    }
    let inline;
    try {
        inline = readInline(value);
    }
    catch {
        throw invalidBlobReference();
    }
    return {
        coreKey: readCoreKey(value),
        inline,
        blobId: {
            blockOffset: readOffset(value, 'blockOffset'),
            blockLength: readOffset(value, 'blockLength'),
            byteOffset: readOffset(value, 'byteOffset'),
            byteLength: readOffset(value, 'byteLength')
        }
    };
}
export function compareBlobReferences(left, right, localCoreKey) {
    try {
        const a = parseBlobReference(left);
        const b = parseBlobReference(right);
        if (a.inline || b.inline) {
            return a.inline?.mimeType === b.inline?.mimeType && a.inline?.data === b.inline?.data;
        }
        return ((a.coreKey ?? localCoreKey) === (b.coreKey ?? localCoreKey) &&
            a.blobId.blockOffset === b.blobId.blockOffset &&
            a.blobId.blockLength === b.blobId.blockLength &&
            a.blobId.byteOffset === b.blobId.byteOffset &&
            a.blobId.byteLength === b.blobId.byteLength);
    }
    catch (error) {
        if (isInvalidBlobReferenceError(error)) {
            return null;
        }
        throw error;
    }
}
function remoteTimeout(options) {
    const timeout = options.remoteTimeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
        throw new TypeError('remote blob timeout must be a positive integer');
    }
    return timeout;
}
async function closeRemote(remote) {
    if (!remote)
        return;
    try {
        await remote.close();
    }
    catch { }
}
export async function* readBlobReference(mesh, blobReference, options = {}) {
    if (isPendingBlobReference(blobReference)) {
        throw blobUnavailable();
    }
    const { blobId, coreKey, inline } = parseBlobReference(blobReference);
    if (options.signal?.aborted) {
        throw new AbortedError();
    }
    if (inline) {
        const data = b4a.from(inline.data, 'base64');
        yield { data, bytesRead: data.length, byteLength: data.length };
        return;
    }
    const local = !coreKey || coreKey === b4a.toHex(mesh.blobs.core.key);
    const readOptions = options.wait === false ? { wait: false } : { timeout: remoteTimeout(options) };
    let remote = null;
    try {
        if (!local) {
            remote = await mesh.openBlobs(b4a.from(coreKey, 'hex'));
        }
        const blobs = remote ?? mesh.blobs;
        yield* readBlob(blobs, blobId, { ...readOptions, signal: options.signal });
    }
    catch (err) {
        if (options.signal?.aborted || err instanceof AbortedError) {
            throw new AbortedError();
        }
        throw blobUnavailable(err);
    }
    finally {
        await closeRemote(remote);
    }
}
export async function downloadBlobReference(mesh, reference, { signal }) {
    const { blobId, coreKey, inline } = parseBlobReference(reference);
    if (signal.aborted) {
        throw new AbortedError();
    }
    if (inline || !blobId.blockLength) {
        return;
    }
    let remote = null;
    try {
        if (coreKey && coreKey !== b4a.toHex(mesh.blobs.core.key)) {
            remote = await mesh.openBlobs(b4a.from(coreKey, 'hex'));
        }
        if (signal.aborted) {
            throw new AbortedError();
        }
        const range = (remote ?? mesh.blobs).core.download({
            start: blobId.blockOffset,
            end: blobId.blockOffset + blobId.blockLength
        });
        try {
            await raceAbort(range.done(), signal);
        }
        finally {
            range.destroy();
        }
    }
    finally {
        await closeRemote(remote);
    }
}
export async function readBlobReferenceBytes(mesh, blobReference, options = {}) {
    const chunks = [];
    for await (const frame of readBlobReference(mesh, blobReference, options)) {
        chunks.push(frame.data);
    }
    return b4a.concat(chunks);
}
