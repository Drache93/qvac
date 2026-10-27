import { classifyRagDocument, contentHash, documentIndexArtifactId, encodeRagArtifact, pipelineVersionFor, RAG_DOCUMENT_KIND } from 'rag-extract';
import { buildArtifactPayload, EmbedderFailure, yieldTurn } from './build.js';
import { isClaimLive } from '../processing/index.js';
import { ClaimLostError } from '../processing/claims.js';
import { contentFailure, failureDetail, failureError, isContentFailure } from './failure.js';
const UNSUPPORTED = 'unsupported';
export const EMBED_RETRY_LIMIT = 5;
export class IndexingPass {
    _embedder;
    _extractors;
    constructor(embedder, extractors = {}) {
        this._embedder = embedder;
        this._extractors = extractors;
    }
    async run(document, signal) {
        const knowledge = document.record;
        const pipelineVersion = pipelineVersionFor(this._embedder.model);
        const artifacts = await document.artifacts();
        const published = artifacts.find((row) => row.embedderVersion === pipelineVersion);
        if (published) {
            await document.ownership.reclaimSuperseded(published.id, published.artifactBlobId);
            await document.claims.settle(published.id);
            return;
        }
        const local = document.state;
        const memo = local.artifactIdMemo;
        if (memo === UNSUPPORTED) {
            return;
        }
        if (memo && (await document.claims.blockedByStatus(memo))) {
            return;
        }
        if (!memo) {
            const statuses = await document.statuses();
            const now = Date.now();
            for (const row of statuses) {
                if (isClaimLive(row, now)) {
                    document.schedule(row.expiresAt);
                    return;
                }
                if (document.claims.isFailed(row.id) || isContentFailure(row)) {
                    return;
                }
            }
        }
        const retryAt = document.source.blockedUntil();
        if (retryAt !== null) {
            document.schedule(retryAt);
            return;
        }
        if (document.paused() || document.closed()) {
            return;
        }
        const read = await document.source.read(signal);
        if (read.kind === 'malformed') {
            local.artifactIdMemo = UNSUPPORTED;
            document.work({ state: 'failed', reason: 'invalid source reference' });
            return;
        }
        if (read.kind === 'missing') {
            const { retryAt } = read;
            document.schedule(retryAt);
            document.work({
                state: 'pending',
                reason: 'source unavailable',
                retryAt
            });
            return;
        }
        const bytes = read.bytes;
        const kind = classifyRagDocument({
            fileName: knowledge.fileName,
            mimeType: knowledge.mimeType,
            bytes
        });
        const refusal = contentFailure(knowledge.fileName, bytes, {
            supported: kind !== RAG_DOCUMENT_KIND.unsupported
        });
        if (refusal?.reason === 'unsupported' && knowledge.chatId) {
            local.artifactIdMemo = UNSUPPORTED;
            document.work({
                state: 'not-applicable',
                reason: 'unsupported file type'
            });
            document.report({
                stage: 'failed',
                processedChunks: 0,
                totalChunks: 0,
                error: `${knowledge.fileName} is not a supported Knowledge file.`
            });
            return;
        }
        if (!refusal && kind === RAG_DOCUMENT_KIND.office && !this._extractors.office) {
            local.artifactIdMemo = UNSUPPORTED;
            document.work({
                state: 'failed',
                reason: 'extractor unavailable on this device'
            });
            return;
        }
        const sourceHash = contentHash(bytes);
        const artifactId = documentIndexArtifactId({
            attachmentId: knowledge.id,
            sourceBlobId: knowledge.blobId,
            sourceHash,
            embeddingModel: this._embedder.model
        });
        local.artifactIdMemo = artifactId;
        if (await document.claims.blockedByStatus(artifactId)) {
            return;
        }
        if (document.paused() || document.closed()) {
            return;
        }
        const claim = await document.claims.claim(artifactId);
        if (!claim) {
            return;
        }
        document.work({ state: 'running' });
        const lease = document.claims.lease(artifactId, claim.claimId);
        let blobRef = null;
        let lastTotal = 0;
        try {
            if (signal.aborted || document.paused() || document.closed()) {
                throw new Error('interrupted: suspend');
            }
            if (refusal) {
                throw refusal;
            }
            const payload = await buildArtifactPayload({
                embedder: this._embedder,
                extractors: this._extractors,
                knowledge,
                artifactId,
                bytes,
                signal,
                onExtracted: async () => {
                    document.admit();
                    await lease.keep(true);
                },
                onProgress: async (processedChunks, totalChunks) => {
                    lastTotal = totalChunks;
                    document.report({
                        stage: 'embedding',
                        processedChunks,
                        totalChunks
                    });
                    await lease.keep();
                }
            });
            await yieldTurn(signal);
            const built = await document.write(encodeRagArtifact(payload));
            blobRef = built.blobRef;
            const current = await document.current();
            if (!current || current.deletedAt || signal.aborted) {
                throw new Error('interrupted: file no longer available');
            }
            const landed = await document.publish({
                id: artifactId,
                sourceHash,
                embedderVersion: pipelineVersion,
                dimensions: payload.dimensions,
                artifactBlobId: built.artifactBlobId
            });
            await document.ownership.onPublished(artifactId, {
                blobRef: built.blobRef,
                artifactBlobId: built.artifactBlobId,
                landedBlobId: landed.artifactBlobId
            });
            const { applied } = await document.resolve({
                artifactId,
                claimId: claim.claimId,
                status: 'ready'
            });
            document.source.clear();
            local.embedFailures = undefined;
            document.report({
                stage: 'ready',
                processedChunks: payload.chunks.length,
                totalChunks: payload.chunks.length
            });
            document.log?.info('rag', applied ? 'indexed' : 'indexed, claim superseded', {
                id: artifactId,
                chunks: payload.chunks.length
            });
        }
        catch (err) {
            if (document.closed()) {
                return;
            }
            if (err instanceof ClaimLostError) {
                document.work({ state: 'pending', reason: 'claimed by another device' });
                document.log?.info('rag', 'indexing claim taken over', { id: artifactId });
                return;
            }
            const interrupted = document.paused() || signal.aborted;
            const message = interrupted ? 'interrupted: suspend' : failureDetail(err);
            const failures = !interrupted && err instanceof EmbedderFailure
                ? (local.embedFailures = (local.embedFailures ?? 0) + 1)
                : 0;
            const retrying = failures > 0 && failures <= EMBED_RETRY_LIMIT;
            const retryAt = retrying ? document.source.miss() : undefined;
            document.work({
                state: interrupted ? 'pending' : 'failed',
                reason: message,
                retryAt
            });
            if (retryAt) {
                document.schedule(retryAt);
            }
            else if (!interrupted) {
                document.claims.markFailed(artifactId);
            }
            if (blobRef) {
                await document.ownership.clearUnreferenced(artifactId, blobRef);
            }
            try {
                await document.resolve({
                    artifactId,
                    claimId: claim.claimId,
                    status: 'failed',
                    error: interrupted ? message : failureError(err)
                });
            }
            catch {
            }
            if (!interrupted) {
                document.report({
                    stage: 'failed',
                    processedChunks: 0,
                    totalChunks: lastTotal,
                    error: message
                });
            }
            document.log?.warn('rag', 'indexing failed', { id: artifactId, error: message });
        }
    }
}
