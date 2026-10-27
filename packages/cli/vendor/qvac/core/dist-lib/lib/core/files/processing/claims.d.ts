import type { Mesh } from '../../mesh.ts';
import type { FileState } from './state.ts';
export interface IndexingClaimsOptions {
    mesh: Mesh;
    schedule: (deadline: number) => void;
    paused: () => boolean;
    closed: () => boolean;
    state?: FileState;
    advisory?: boolean;
}
export interface IndexingClaim {
    readonly claimId: string;
}
export interface IndexingLease {
    keep(force?: boolean): Promise<void>;
}
export declare class ClaimLostError extends Error {
    constructor(artifactId: string);
}
export declare class IndexingClaims {
    private readonly _mesh;
    private readonly _schedule;
    private readonly _paused;
    private readonly _closed;
    private readonly _state;
    private readonly _advisory;
    constructor(opts: IndexingClaimsOptions);
    markFailed(artifactId: string): void;
    isFailed(artifactId: string): boolean;
    claim(artifactId: string, knowledgeId: string): Promise<IndexingClaim | null>;
    lease(artifactId: string, claimId: string): IndexingLease;
    blockedByStatus(artifactId: string): Promise<boolean>;
    settle(artifactId: string, knowledgeId: string): Promise<void>;
}
