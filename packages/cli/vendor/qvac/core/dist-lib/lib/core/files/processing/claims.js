import { INDEXING_STALE_MS, claimIndexing, getIndexingStatus, isClaimLive, progressIndexing, resolveIndexing } from './protocol.js';
import { isContentFailure } from '../rag/failure.js';
export class ClaimLostError extends Error {
    constructor(artifactId) {
        super(`indexing claim taken over: ${artifactId}`);
        this.name = 'ClaimLostError';
    }
}
export class IndexingClaims {
    _mesh;
    _schedule;
    _paused;
    _closed;
    _state;
    _advisory;
    constructor(opts) {
        this._mesh = opts.mesh;
        this._schedule = opts.schedule;
        this._paused = opts.paused;
        this._closed = opts.closed;
        this._state = opts.state ?? opts.mesh.files.state;
        this._advisory = opts.advisory ?? false;
    }
    markFailed(artifactId) {
        this._state.artifact(artifactId).terminal = true;
    }
    isFailed(artifactId) {
        return this._state.artifact(artifactId).terminal === true;
    }
    async claim(artifactId, knowledgeId) {
        try {
            const { row, won } = await claimIndexing(this._mesh, {
                artifactId,
                knowledgeId,
                at: Date.now()
            });
            if (won) {
                return { claimId: row.claimId };
            }
            if (isClaimLive(row, Date.now())) {
                this._schedule(row.expiresAt);
            }
            return null;
        }
        catch (err) {
            if (this._advisory &&
                !this._closed() &&
                !this._paused() &&
                !(await getIndexingStatus(this._mesh, artifactId))) {
                return { claimId: '' };
            }
            this._mesh.log?.debug('rag', 'claim not placed', { id: artifactId, err });
            return null;
        }
    }
    lease(artifactId, claimId) {
        let last = Date.now();
        return {
            keep: async (force = false) => {
                const at = Date.now();
                if (!claimId || (!force && at - last < INDEXING_STALE_MS / 3)) {
                    return;
                }
                last = at;
                if (!(await progressIndexing(this._mesh, { artifactId, claimId, at }))) {
                    throw new ClaimLostError(artifactId);
                }
            }
        };
    }
    async blockedByStatus(artifactId) {
        const row = await getIndexingStatus(this._mesh, artifactId);
        if (this.isFailed(artifactId)) {
            if (row) {
                return true;
            }
            this._state.artifact(artifactId).terminal = false;
        }
        if (!row) {
            return false;
        }
        if (row.status === 'ready' || isContentFailure(row)) {
            return true;
        }
        if (isClaimLive(row, Date.now())) {
            this._schedule(row.expiresAt);
            return true;
        }
        return false;
    }
    async settle(artifactId, knowledgeId) {
        if (this._paused() || this._closed())
            return;
        const row = await getIndexingStatus(this._mesh, artifactId);
        if (row?.status === 'ready') {
            return;
        }
        if (row && isClaimLive(row, Date.now())) {
            this._schedule(row.expiresAt);
            return;
        }
        if (this._paused() || this._closed()) {
            return;
        }
        const claim = await this.claim(artifactId, knowledgeId);
        if (!claim?.claimId) {
            return;
        }
        try {
            const { applied } = await resolveIndexing(this._mesh, {
                artifactId,
                claimId: claim.claimId,
                status: 'ready'
            });
            if (applied) {
                this._mesh.log?.info('rag', 'repaired to ready', { id: artifactId });
            }
        }
        catch (err) {
            this._mesh.log?.debug('rag', 'repair resolve dropped', { id: artifactId, err });
        }
    }
}
