import { contentHash, decodeRagArtifact, pipelineVersionFor } from 'rag-extract';
import { compareBlobReferences } from '../store/index.js';
import { buildArtifactPayload, EmbedderFailure } from './build.js';
import { EMBED_RETRY_LIMIT } from './produce.js';
import { errorMessage } from '../../../guards.js';
export function pickArtifact(rows, opts) {
    const candidates = rows.filter((row) => !opts.skip.has(row.id) &&
        !sameReference(opts.failed(row.id), row.artifactBlobId, opts.localCoreKey) &&
        row.embedderVersion.startsWith(`${opts.model}|`) &&
        (opts.pinnedDimensions === null || row.dimensions === opts.pinnedDimensions));
    if (candidates.length === 0) {
        return null;
    }
    const exactVersion = pipelineVersionFor(opts.model);
    const exact = candidates.filter((row) => row.embedderVersion === exactVersion);
    const pool = exact.length > 0 ? exact : candidates;
    return pool.reduce((newest, row) => (row.createdAt > newest.createdAt ? row : newest));
}
export class HydratePass {
    _model;
    _index;
    _embedder;
    _extractors;
    constructor(opts) {
        this._model = opts.model;
        this._index = opts.index;
        this._embedder = opts.embedder;
        this._extractors = opts.extractors;
    }
    async run(document, signal) {
        const knowledge = document.record;
        const local = document.state;
        let entry = local.loaded;
        if (knowledge.deletedAt) {
            if (!entry) {
                return;
            }
            if (entry.evict) {
                await this._index.remove(entry.evict);
            }
            await this._index.remove(entry.artifactId);
            local.loaded = undefined;
            document.load({ state: 'pending' });
            document.output(entry.artifactId, entry.blobRef ?? '').clear();
            return;
        }
        const rows = await document.artifacts();
        const localCoreKey = document.localCoreKey;
        const skip = new Set();
        for (;;) {
            const pick = pickArtifact(rows, {
                model: this._model,
                pinnedDimensions: this._index.info().dimensions,
                failed: (id) => document.readArtifact(id)?.failedReference,
                localCoreKey,
                skip
            });
            if (!pick) {
                if (entry) {
                    document.load({ state: 'ready' }, entry.artifactId);
                }
                const repair = rows.find((row) => {
                    const artifact = document.readArtifact(row.id);
                    return (row.embedderVersion === pipelineVersionFor(this._model) &&
                        (sameReference(artifact?.failedReference, row.artifactBlobId, localCoreKey) ||
                            (sameReference(artifact?.unavailable?.blobRef, row.artifactBlobId, localCoreKey) &&
                                artifact?.unavailable?.repeated)));
                });
                if (!entry && repair && signal) {
                    await this._rebuild(document, repair, signal);
                }
                return;
            }
            if (entry &&
                entry.artifactId === pick.id &&
                sameReference(entry.blobRef, pick.artifactBlobId, localCoreKey)) {
                if (entry.evict) {
                    await this._index.remove(entry.evict);
                    local.loaded = { artifactId: entry.artifactId, blobRef: entry.blobRef };
                }
                document.load({ state: 'ready' }, entry.artifactId);
                return;
            }
            const retryAt = document.output(pick.id, pick.artifactBlobId).blockedUntil();
            if (retryAt !== null) {
                document.schedule(retryAt);
                skip.add(pick.id);
                continue;
            }
            if (document.paused() || document.closed()) {
                return;
            }
            const read = await document.output(pick.id, pick.artifactBlobId).read(signal);
            if (read.kind === 'malformed') {
                document.load({ state: 'failed', reason: 'invalid output reference' }, entry?.artifactId);
                document.artifact(pick.id).failedReference = pick.artifactBlobId;
                continue;
            }
            if (read.kind === 'missing') {
                const artifact = document.artifact(pick.id);
                artifact.unavailable = {
                    blobRef: pick.artifactBlobId,
                    repeated: sameReference(artifact.unavailable?.blobRef, pick.artifactBlobId, localCoreKey)
                };
                const { retryAt } = read;
                document.schedule(retryAt);
                document.load({
                    state: 'pending',
                    reason: 'output unavailable on this device',
                    retryAt
                }, entry?.artifactId);
                skip.add(pick.id);
                continue;
            }
            document.output(pick.id, pick.artifactBlobId).clear();
            document.artifact(pick.id).unavailable = undefined;
            let chunks;
            try {
                const payload = decodeRagArtifact(read.bytes);
                if (payload.dimensions !== pick.dimensions || payload.modelName !== this._model) {
                    throw new Error(`artifact payload is ${payload.modelName} at ${payload.dimensions} dimensions, ` +
                        `the row says ${this._model} at ${pick.dimensions}`);
                }
                chunks = payload.chunks;
            }
            catch (err) {
                document.artifact(pick.id).failedReference = pick.artifactBlobId;
                document.log?.warn('rag', 'artifact undecodable, pinned for the session', {
                    id: pick.id,
                    err
                });
                continue;
            }
            if (document.paused() || document.closed()) {
                return;
            }
            const live = await document.current();
            if (!live || live.deletedAt || signal?.aborted) {
                return;
            }
            try {
                await this._index.upsert(pick.id, chunks);
            }
            catch (err) {
                document.artifact(pick.id).failedReference = pick.artifactBlobId;
                document.log?.warn('rag', 'artifact rejected by the vector index', { id: pick.id, err });
                continue;
            }
            const evict = entry && entry.artifactId !== pick.id ? entry.artifactId : undefined;
            local.loaded = { artifactId: pick.id, blobRef: pick.artifactBlobId, evict };
            if (signal.aborted || document.closed()) {
                return;
            }
            document.load({ state: 'ready' }, pick.id);
            entry = undefined;
            if (evict) {
                await this._index.remove(evict);
                local.loaded = { artifactId: pick.id, blobRef: pick.artifactBlobId };
            }
            document.log?.info('rag', 'hydrated knowledge into the vector index', {
                artifactId: pick.id,
                chunks: chunks.length
            });
            return;
        }
    }
    async _rebuild(document, artifact, signal) {
        const knowledge = document.record;
        const local = document.artifact(artifact.id);
        if (!this._embedder ||
            (local.rebuildFailures ?? 0) > EMBED_RETRY_LIMIT ||
            document.paused() ||
            document.closed() ||
            signal.aborted) {
            return;
        }
        const retryAt = document.output(knowledge.id, knowledge.blobId).blockedUntil();
        if (retryAt !== null) {
            document.schedule(retryAt);
            return;
        }
        const read = await document.output(knowledge.id, knowledge.blobId).read(signal);
        if (read.kind === 'malformed') {
            local.rebuildFailures = Infinity;
            document.load({ state: 'failed', reason: 'invalid source reference' });
            return;
        }
        if (read.kind !== 'bytes') {
            document.schedule(read.retryAt);
            document.load({
                state: 'pending',
                reason: 'source and output unavailable',
                retryAt: read.retryAt
            });
            return;
        }
        try {
            if (contentHash(read.bytes) !== artifact.sourceHash) {
                throw new Error('source does not match the published output');
            }
            document.load({ state: 'running', reason: 'rebuilding local index' });
            const payload = await buildArtifactPayload({
                embedder: this._embedder,
                extractors: this._extractors,
                knowledge,
                artifactId: artifact.id,
                bytes: read.bytes,
                signal,
                onProgress: (processedChunks, totalChunks) => document.report({
                    stage: 'embedding',
                    processedChunks,
                    totalChunks
                })
            });
            const live = await document.current();
            if (!live || live.deletedAt || signal.aborted || document.paused() || document.closed()) {
                return;
            }
            if (payload.dimensions !== artifact.dimensions) {
                throw new Error('rebuilt output has incompatible dimensions');
            }
            await this._index.upsert(artifact.id, payload.chunks);
            document.state.loaded = {
                artifactId: artifact.id,
                blobRef: artifact.artifactBlobId
            };
            if (signal.aborted || document.closed()) {
                return;
            }
            document.output(knowledge.id, knowledge.blobId).clear();
            local.rebuildFailures = undefined;
            document.load({ state: 'ready' }, artifact.id);
            document.report({
                stage: 'ready',
                processedChunks: payload.chunks.length,
                totalChunks: payload.chunks.length
            });
        }
        catch (error) {
            if (document.closed()) {
                return;
            }
            if (signal.aborted || document.paused()) {
                document.load({ state: 'pending', reason: 'processing interrupted' });
                return;
            }
            const failures = error instanceof EmbedderFailure ? (local.rebuildFailures ?? 0) + 1 : Infinity;
            local.rebuildFailures = failures;
            const retryAt = failures <= EMBED_RETRY_LIMIT
                ? document.output(knowledge.id, knowledge.blobId).miss()
                : undefined;
            if (retryAt) {
                document.schedule(retryAt);
            }
            document.load({
                state: 'failed',
                reason: errorMessage(error),
                retryAt
            });
        }
    }
}
function sameReference(left, right, localCoreKey) {
    return left !== undefined && (compareBlobReferences(left, right, localCoreKey) ?? left === right);
}
