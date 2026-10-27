import type { BlobId } from 'hyperblobs';
import type { Mesh } from '../../mesh.ts';
import type { FileState } from './state.ts';
export interface WrittenArtifact {
    readonly blobRef: BlobId;
    readonly artifactBlobId: string;
}
export interface PublishedArtifact extends WrittenArtifact {
    readonly landedBlobId: string;
}
export declare class ArtifactOwnership {
    private readonly _mesh;
    private readonly _state;
    constructor(mesh: Mesh, state?: FileState);
    onPublished(artifactId: string, { blobRef, artifactBlobId, landedBlobId }: PublishedArtifact): Promise<void>;
    reclaimSuperseded(artifactId: string, winnerBlobId: string): Promise<void>;
    clearUnreferenced(artifactId: string, blobRef: BlobId): Promise<void>;
}
