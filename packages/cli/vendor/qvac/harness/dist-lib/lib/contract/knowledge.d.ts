import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export interface KnowledgeChunk {
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
}
export interface KnowledgeEmbedding {
    model: string;
    dimensions: number;
    vectors: number[][];
}
export interface KnowledgeArtifact {
    artifactId: string;
    version?: string;
    scope: string;
    chunks: KnowledgeChunk[];
    embedding?: KnowledgeEmbedding;
}
export interface KnowledgeUpsertResult {
    added: number;
    embedded: KnowledgeEmbedding | null;
}
export interface KnowledgeQuery {
    text: string;
    scopes: readonly string[];
    k?: number;
    signal?: BareAbortSignal;
}
export interface KnowledgeHit {
    artifactId: string;
    chunkId: string;
    scope: string;
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
}
export interface KnowledgeArtifactStatus {
    artifactId: string;
    version?: string;
    scope: string;
    chunks: number;
}
export interface KnowledgeStatus {
    model: string;
    dimensions: number;
    chunks: number;
    artifacts: KnowledgeArtifactStatus[];
}
export interface KnowledgeGrant {
    scopes: string[];
}
export interface KnowledgeRemoved {
    removed: number;
}
export interface KnowledgeService {
    upsert(artifact: KnowledgeArtifact): Promise<KnowledgeUpsertResult>;
    remove(artifactId: string): Promise<KnowledgeRemoved>;
    search(query: KnowledgeQuery): Promise<KnowledgeHit[]>;
    status(): Promise<KnowledgeStatus>;
}
