import type { QvacIndexingResolution, QvacIndexingStatus } from '../../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../../mesh.ts';
import type { ChatScope, KnowledgeScope } from '../records/knowledge.ts';
export { INDEXING_CLAIM_TTL_MS, INDEXING_MAX_CLOCK_SKEW_MS, INDEXING_STALE_MS } from '../../contract/indexing.ts';
export declare function isClaimLive(row: QvacIndexingStatus, at: number): boolean;
export interface ClaimIndexingInput {
    artifactId: string;
    knowledgeId: string;
    at: number;
}
export interface IndexingClaimResult {
    readonly row: QvacIndexingStatus;
    readonly won: boolean;
}
export interface ProgressIndexingInput {
    readonly artifactId: string;
    readonly claimId: string;
    readonly at: number;
}
export interface ResolveIndexingInput {
    readonly artifactId: string;
    readonly claimId: string;
    readonly status: QvacIndexingResolution;
    readonly error?: string;
}
export interface IndexingResolutionResult {
    readonly row: QvacIndexingStatus;
    readonly applied: boolean;
}
export declare function getIndexingStatus(store: Mesh, artifactId: string): Promise<QvacIndexingStatus | null>;
export declare function listIndexingByKnowledge(store: Mesh, { knowledgeId }: KnowledgeScope): Promise<QvacIndexingStatus[]>;
export declare function listIndexingByChat(store: Mesh, { chatId }: ChatScope): Promise<QvacIndexingStatus[]>;
export declare function claimIndexing(store: Mesh, { artifactId, knowledgeId, at }: ClaimIndexingInput): Promise<IndexingClaimResult>;
export declare function progressIndexing(store: Mesh, { artifactId, claimId, at }: ProgressIndexingInput): Promise<boolean>;
export declare function resolveIndexing(store: Mesh, { artifactId, claimId, status, error }: ResolveIndexingInput): Promise<IndexingResolutionResult>;
