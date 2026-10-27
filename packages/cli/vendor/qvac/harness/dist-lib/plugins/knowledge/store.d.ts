import type { KnowledgeArtifact, KnowledgeHit, KnowledgeQuery, KnowledgeRemoved, KnowledgeService, KnowledgeStatus, KnowledgeUpsertResult } from '../../lib/contract/knowledge.ts';
import type { EmbedHost } from '../../lib/contract/models.ts';
export interface KnowledgeStoreOptions {
    dir: string;
    model: string;
    maxChunks?: number;
    minScore?: number;
    embed: EmbedHost;
}
export declare class KnowledgeStore implements KnowledgeService {
    private readonly _dir;
    private readonly _model;
    private readonly _maxChunks;
    private readonly _minScore;
    private readonly _embed;
    private _manifest;
    private _index;
    private _opened;
    private _lane;
    constructor({ dir, model, maxChunks, minScore, embed }: KnowledgeStoreOptions);
    upsert(artifact: KnowledgeArtifact): Promise<KnowledgeUpsertResult>;
    remove(artifactId: string): Promise<KnowledgeRemoved>;
    search(query: KnowledgeQuery): Promise<KnowledgeHit[]>;
    status(): Promise<KnowledgeStatus>;
    close(): Promise<void>;
    private _serial;
    private _recovering;
    private _open;
    private _rebuild;
    private _unload;
    private _upsert;
    private _add;
    private _embedChunks;
    private _indexFor;
    private _drop;
    private _evict;
    private _search;
    private _chunksById;
    private _chunkCount;
    private _file;
    private _persist;
}
