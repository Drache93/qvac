import type { LoggerInterface } from '@qvac/logging';
import ScopeLock from 'scope-lock';
import type { AbortSignal } from 'bare-abort-controller';
import type { QvacKnowledge } from '../../../../spec/mesh/hyperschema/types.d.ts';
import { type RagExtractors, type VectorIndex } from 'rag-extract';
import { type IndexingEmbedder } from './produce.ts';
import { type IndexingDevice } from './policy.ts';
import type { FileDocument, FileProcessor, ProcessorHost } from '../processing/index.ts';
import type { LoadedArtifact } from '../processing/state.ts';
export interface RagProcessorOptions {
    readonly model: string;
    readonly embedder?: IndexingEmbedder;
    readonly index?: VectorIndex | null;
    readonly extractors?: RagExtractors;
    readonly batches?: ScopeLock;
    readonly device?: IndexingDevice;
    readonly log: LoggerInterface | null;
}
export declare class RagProcessor implements FileProcessor {
    readonly id = "rag";
    readonly input = "knowledge";
    readonly output = "blob";
    readonly version: string;
    private readonly _producer;
    private readonly _device?;
    readonly load?: (document: FileDocument, signal: AbortSignal) => Promise<void>;
    private readonly _index;
    private readonly _log;
    constructor(options: RagProcessorOptions);
    applies(_document: QvacKnowledge): boolean;
    canProduce(document: QvacKnowledge, host: ProcessorHost): Promise<boolean>;
    produce(document: FileDocument, signal: AbortSignal): Promise<void>;
    private _settled;
    evict(loaded: LoadedArtifact): Promise<void>;
    close(): Promise<boolean>;
}
export { MAX_KNOWLEDGE_BYTES } from './limits.ts';
export { joinedIndex } from './joined-index.ts';
export { canIndexKnowledge } from './policy.ts';
export type { IndexingDevice } from './policy.ts';
export type { IndexingEmbedder, IndexingProgress } from './produce.ts';
export { formatFullDocumentContext, fullTextBudgetChars, fullTextHits, isFullTextHit, isTruncatedFullTextHit } from './retrieval/full-text.ts';
export { MemoryVectorIndex, RAG_DOCUMENT_KIND, RAG_KNOWLEDGE_OFF_NOTICE, RAG_TRUNCATED_NOTICE, RAG_UNAVAILABLE_NOTICE, WEB_TOOLS, chooseRagNotice, citedByPhraseOverlap, classifyRagDocument, createRagSourceTagFilter, encodeRagArtifact, formatRagContext, isSupportedRagDocument, isWholeDocumentQuery, referencedDocuments, referencesPendingFile, retrieveRagKnowledge, searchRagChunks, sourcesFromHits, webSourcesFromToolResult, withoutDataChannel } from 'rag-extract';
export type { RagArtifactPayload, RagDocumentRef, RagExtractors, RagSource, VectorHit, VectorIndex } from 'rag-extract';
