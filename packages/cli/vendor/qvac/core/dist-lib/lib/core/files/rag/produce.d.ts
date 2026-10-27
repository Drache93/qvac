import type { AbortSignal } from 'bare-abort-controller';
import { type RagExtractors } from 'rag-extract';
import { type BuildEmbedder } from './build.ts';
import { type FileDocument } from '../processing/index.ts';
export interface IndexingEmbedder extends BuildEmbedder {
}
export type IndexingProgress = (update: {
    knowledgeId: string;
    chatId?: string | null;
    stage: 'embedding' | 'ready' | 'failed';
    processedChunks: number;
    totalChunks: number;
    error?: string;
}) => void;
export declare const EMBED_RETRY_LIMIT = 5;
export declare class IndexingPass {
    private readonly _embedder;
    private readonly _extractors;
    constructor(embedder: IndexingEmbedder, extractors?: RagExtractors);
    run(document: FileDocument, signal: AbortSignal): Promise<void>;
}
