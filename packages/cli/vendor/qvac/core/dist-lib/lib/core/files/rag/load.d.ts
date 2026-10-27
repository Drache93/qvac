import type { QvacKnowledgeArtifact } from '../../../../spec/mesh/hyperschema/types.d.ts';
import { type RagExtractors, type VectorIndex } from 'rag-extract';
import type { FileDocument } from '../processing/index.ts';
import type { AbortSignal } from 'bare-abort-controller';
import { type BuildEmbedder } from './build.ts';
export interface HydratePassOptions {
    model: string;
    index: VectorIndex;
    embedder?: BuildEmbedder;
    extractors?: RagExtractors;
}
export interface PickArtifactOptions {
    readonly model: string;
    readonly pinnedDimensions: number | null;
    readonly failed: (id: string) => string | undefined;
    readonly localCoreKey?: string;
    readonly skip: ReadonlySet<string>;
}
export declare function pickArtifact(rows: QvacKnowledgeArtifact[], opts: PickArtifactOptions): QvacKnowledgeArtifact | null;
export declare class HydratePass {
    private readonly _model;
    private readonly _index;
    private readonly _embedder;
    private readonly _extractors;
    constructor(opts: HydratePassOptions);
    run(document: FileDocument, signal: AbortSignal): Promise<void>;
    private _rebuild;
}
