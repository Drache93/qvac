import { compareBlobReferences } from '../store/index.js';
import b4a from 'b4a';
export class ArtifactOwnership {
    _mesh;
    _state;
    constructor(mesh, state = mesh.files.state) {
        this._mesh = mesh;
        this._state = state;
    }
    async onPublished(artifactId, { blobRef, artifactBlobId, landedBlobId }) {
        if (compareBlobReferences(landedBlobId, artifactBlobId, b4a.toHex(this._mesh.blobs.core.key)) ===
            false) {
            await this._mesh.files.clear(this._mesh.files.reference(blobRef), artifactId).catch(noop);
            return;
        }
        this._state.artifact(artifactId).published = { artifactBlobId };
    }
    async reclaimSuperseded(artifactId, winnerBlobId) {
        const local = this._state.artifact(artifactId);
        const mine = local.published;
        if (!mine ||
            compareBlobReferences(mine.artifactBlobId, winnerBlobId, b4a.toHex(this._mesh.blobs.core.key)) !== false) {
            return;
        }
        local.published = undefined;
        await this._mesh.files.clear(mine.artifactBlobId, artifactId).catch(noop);
    }
    async clearUnreferenced(artifactId, blobRef) {
        try {
            const row = await this._mesh.files.artifact(artifactId);
            const mine = this._mesh.files.reference(blobRef);
            if (row &&
                compareBlobReferences(row.artifactBlobId, mine, b4a.toHex(this._mesh.blobs.core.key)) !==
                    false) {
                this._state.artifact(artifactId).published = { artifactBlobId: mine };
                return;
            }
            await this._mesh.files.clear(this._mesh.files.reference(blobRef), artifactId).catch(noop);
        }
        catch {
        }
    }
}
const noop = () => { };
