import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { processorArtifactId } from '../records/index.js';
import { isPendingBlobReference, parseBlobReference } from '../store/index.js';
import { IMAGE_MIMES } from '../../image/normalize.js';
import { previewEncoder } from './image.js';
import { AbortedError } from '@qvac/harness/race-abort';
import { getChat } from '../../chat.js';
import { errorMessage } from '../../../guards.js';
export { previewEncoder } from './image.js';
export const PREVIEW_VERSION = 'processor:preview:1';
const RETRY_MS = 30_000;
export class PreviewProcessor {
    id = 'preview';
    version = PREVIEW_VERSION;
    input = 'attachment';
    output = 'inline';
    mediaKind = 'image';
    _deviceId;
    _retryMs;
    _encoder;
    constructor(options) {
        this._deviceId = options.deviceId;
        this._retryMs = options.retryMs ?? RETRY_MS;
        this._encoder = options.encoder ?? previewEncoder;
    }
    applies(file) {
        return (file.kind === 'attachment' &&
            file.preview === true &&
            IMAGE_MIMES.has(file.mimeType.toLowerCase()));
    }
    async canProduce(file, host) {
        const chat = file.chatId ? await getChat(host.mesh, file.chatId) : null;
        return !file.deletedAt && !chat?.deletedAt;
    }
    accepts(output, file) {
        if (output.embedderVersion !== this.version)
            return false;
        try {
            return output.id === previewId(file);
        }
        catch {
            return false;
        }
    }
    async produce(document, signal) {
        const file = document.record;
        const id = previewId(file);
        document.state.artifactIdMemo = id;
        const existing = (await document.artifacts()).find((row) => this.accepts(row, file));
        if (existing) {
            document.work({ state: 'ready' });
            await document.claims.settle(id);
            return;
        }
        if (document.claims.isFailed(id)) {
            return;
        }
        const encode = await this._encoder();
        if (!encode) {
            document.work({ state: 'pending', reason: 'image processor unavailable on this device' });
            return;
        }
        if (!this._deviceId ||
            !file.originDeviceId ||
            !b4a.equals(this._deviceId, file.originDeviceId)) {
            document.state.preferredUntil ??= Math.min(file.createdAt, Date.now()) + this._retryMs;
            if (document.state.preferredUntil > Date.now()) {
                document.work({
                    state: 'pending',
                    reason: 'waiting for uploader',
                    retryAt: document.state.preferredUntil
                });
                document.schedule(document.state.preferredUntil);
                return;
            }
        }
        const retryAt = document.source.blockedUntil();
        if (retryAt) {
            document.schedule(retryAt);
            return;
        }
        if (await document.claims.blockedByStatus(id)) {
            return;
        }
        const source = await document.source.read(signal);
        if (source.kind !== 'bytes') {
            const retryAt = source.kind === 'missing' ? source.retryAt : undefined;
            document.work({
                state: source.kind === 'missing' ? 'pending' : 'failed',
                reason: 'source unavailable',
                retryAt
            });
            if (retryAt) {
                document.schedule(retryAt);
            }
            return;
        }
        if (signal.aborted || document.paused() || document.closed()) {
            return;
        }
        const claim = await document.claims.claim(id);
        if (!claim) {
            return;
        }
        document.work({ state: 'running' });
        try {
            const bytes = await encode(source.bytes, signal);
            const current = await document.current();
            if (signal.aborted) {
                throw new AbortedError();
            }
            if (!current || current.deletedAt || previewId(current) !== id) {
                throw new Error('source no longer available');
            }
            await document.publish({
                id,
                sourceHash: previewSource(file),
                embedderVersion: this.version,
                dimensions: 0,
                artifactBlobId: document.inline(bytes, 'image/jpeg')
            });
            if (claim.claimId) {
                await document.resolve({ artifactId: id, claimId: claim.claimId, status: 'ready' });
            }
            document.source.clear();
            document.work({ state: 'ready' });
        }
        catch (error) {
            const interrupted = signal.aborted || document.paused() || document.closed();
            const detail = errorMessage(error);
            const reason = interrupted ? 'interrupted: suspend' : detail;
            document.work({ state: interrupted ? 'pending' : 'failed', reason });
            if (!interrupted) {
                document.claims.markFailed(id);
            }
            if (claim.claimId && !document.closed()) {
                await document
                    .resolve({ artifactId: id, claimId: claim.claimId, status: 'failed', error: reason })
                    .catch(noop);
            }
        }
    }
    close() {
        return Promise.resolve(true);
    }
}
export function previewId(file) {
    return processorArtifactId({
        processorId: 'preview',
        hash: hash([file.id, previewSource(file), PREVIEW_VERSION])
    });
}
function previewSource(file) {
    if (isPendingBlobReference(file.blobId)) {
        return hash([file.blobId]);
    }
    const { blobId, coreKey } = parseBlobReference(file.blobId);
    return hash([
        coreKey ?? '',
        blobId.blockOffset,
        blobId.blockLength,
        blobId.byteOffset,
        blobId.byteLength
    ]);
}
function hash(values) {
    return b4a.toHex(crypto.hash(b4a.from(JSON.stringify(values))));
}
function noop() { }
