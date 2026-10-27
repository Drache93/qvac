import type { AbortSignal } from 'bare-abort-controller';
import EventEmitter from 'bare-events';
import type { AssistantFileStatusList, AssistantFileReadRequest, AssistantFileReadFrame, AssistantFilePreviewResponse, AssistantIndexingStatusList, AssistantKnowledgeBaseList } from '../../../spec/hyperschema/types.d.ts';
import type { QvacChunk, QvacKnowledge, QvacKnowledgeArtifact } from '../../../spec/mesh/hyperschema/types.d.ts';
import { attachmentFiles } from './attachments.ts';
import { addKnowledgeArtifact, type FileRecord } from './records/index.ts';
import { knowledgeFiles } from './knowledge.ts';
import { FileState, type LocalWork, type FileProcessor } from './processing/index.ts';
import type ScopeLock from 'scope-lock';
import { BlobStore } from './store/index.ts';
import { type IndexingDevice, type IndexingProgress, type IndexingEmbedder, type RagExtractors, type VectorIndex } from './rag/index.ts';
import type { Mesh } from '../mesh.ts';
import type { ChatFileKey } from './records/source.ts';
import type { SettleOptions } from './processing/settle.ts';
export { fullTextBudgetChars, fullTextHits, joinedIndex, retrieveRagKnowledge, searchRagChunks, referencesPendingFile, type VectorHit, type RagDocumentRef } from './rag/index.ts';
export { isKnowledgeRoutedAttachment } from './records/index.ts';
export { assertRemovableAt } from './records/index.ts';
export { assertArtifactOutput } from './records/index.ts';
export { claimSource } from './records/index.ts';
export interface RetryFileRequest {
    readonly chatId?: string | null;
    readonly fileId: string;
    readonly processorId: string;
}
export interface FileReadOptions {
    readonly signal?: AbortSignal;
}
export interface StartProcessorOptions {
    readonly deviceId: Buffer | null;
    readonly device?: IndexingDevice;
}
export interface StartProcessingOptions extends StartProcessorOptions {
    readonly embedder: IndexingEmbedder;
    readonly index: VectorIndex;
    readonly extractors?: RagExtractors;
    readonly batches?: ScopeLock;
}
export interface FileLoadOptions {
    readonly artifactId?: string;
    readonly processorId?: string;
}
export interface BeginUploadInput {
    readonly fileId?: string | null;
    readonly chatId?: string | null;
    readonly fileName?: string | null;
    readonly mimeType?: string | null;
    readonly totalBytes?: number | null;
    readonly data?: Buffer | null;
}
export interface BegunUpload {
    readonly id: string;
}
export declare class Files extends EventEmitter {
    private readonly _mesh;
    private readonly _uploads;
    readonly state: FileState;
    private readonly _states;
    private readonly _processors;
    private readonly _store;
    private readonly _deadline;
    private readonly _updated;
    private _model;
    private _paused;
    closed: boolean;
    constructor(mesh: Mesh);
    read(reference: string, options?: Parameters<BlobStore['read']>[1]): AsyncGenerator<import("./store/blob.ts").BlobReadChunk, void, unknown>;
    readBytes(reference: string, options?: Parameters<BlobStore['readBytes']>[1]): Promise<Buffer<ArrayBufferLike>>;
    download(reference: string, options: Parameters<BlobStore['download']>[1]): Promise<void>;
    write(chunks: AsyncIterable<Uint8Array>, options?: Parameters<BlobStore['write']>[1]): AsyncGenerator<import("./store/blob.ts").WriteProgress, any, any>;
    put(bytes: Buffer): Promise<{
        blobRef: import("hyperblobs").BlobId;
        reference: string;
    }>;
    inline(bytes: Buffer, mimeType: string): string;
    reference(id: Parameters<BlobStore['reference']>[0]): string;
    clear(reference: string, id: string): Promise<boolean>;
    clearFetched(reference: string, id: string): Promise<void>;
    compact(coreKeys: ReadonlyArray<Buffer>): Promise<void>;
    attachments(options?: Parameters<typeof attachmentFiles>[1]): import("./attachments.ts").BoundAttachments;
    knowledge(options?: Parameters<typeof knowledgeFiles>[1]): import("./knowledge.ts").KnowledgeFiles;
    listKnowledge(chatId: string): Promise<QvacKnowledge[]>;
    knowledgeBase(): Promise<AssistantKnowledgeBaseList>;
    record(id: string): Promise<QvacKnowledge | null>;
    resolve(request: ChatFileKey): Promise<FileRecord | null>;
    fileRead(request: Omit<AssistantFileReadRequest, 'meshId'>, options?: FileReadOptions): AsyncGenerator<AssistantFileReadFrame>;
    preview(request: ChatFileKey): Promise<AssistantFilePreviewResponse>;
    retry({ chatId, fileId, processorId }: RetryFileRequest): Promise<void>;
    private _retryKnowledgeBase;
    artifact(id: string): Promise<QvacKnowledgeArtifact | null>;
    artifacts(id: string): Promise<QvacKnowledgeArtifact[]>;
    publish(input: Parameters<typeof addKnowledgeArtifact>[1]): Promise<QvacKnowledgeArtifact>;
    hasLiveSource(chatId: string, reference: string): Promise<boolean>;
    syncAttachments(chunks: ReadonlyArray<QvacChunk>): Promise<void>;
    reclaimAttachments(chunks: ReadonlyArray<QvacChunk>): Promise<void>;
    syncKnowledge(row: QvacKnowledge): Promise<void>;
    syncArtifact(row: QvacKnowledgeArtifact): Promise<void>;
    reclaimPurged(): Promise<number>;
    sweepTombstones(deviceId?: Buffer | null): Promise<void>;
    sweepOrphans(coreLength: number): Promise<void>;
    processorState(id: string): FileState;
    start(options: StartProcessorOptions): void;
    startProcessor(processor: FileProcessor, options: StartProcessorOptions): void;
    stopProcessor(id: string): Promise<boolean>;
    private get _processing();
    startProcessing(options: StartProcessingOptions): void;
    rescan(): void;
    stopProcessing(): Promise<boolean>;
    suspend(): Promise<void>;
    resume(): void;
    listIndexing(chatId: string): Promise<AssistantIndexingStatusList>;
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    setModel(model: string | null): void;
    work(id: string, state: LocalWork, processorId?: string): void;
    load(id: string, state: LocalWork, options?: FileLoadOptions): void;
    clearLoaded(processorId?: string): void;
    hydratedArtifact(id: string): string | null;
    settle(ids: string[], options?: SettleOptions): Promise<void>;
    reconnect(): void;
    report: (update: Parameters<IndexingProgress>[0], processorId?: string) => void;
    progress(chatId: string): import("./processing/state.ts").ChatProgressEntry[];
    beginUpload(input: BeginUploadInput): Promise<BegunUpload>;
    uploadProgress(id: string, bytes: number): void;
    uploadComplete(id: string): void;
    uploadFailed(id: string, error: unknown): void;
    uploadClosed(id: string): void;
    private _pruneUploads;
    status(chatId: string): Promise<AssistantFileStatusList>;
    private _markClaimed;
    private _extraProcessorStatuses;
    private _processorStatus;
    close(): Promise<void>;
}
export { MemoryVectorIndex, RAG_KNOWLEDGE_OFF_NOTICE, RAG_TRUNCATED_NOTICE, RAG_UNAVAILABLE_NOTICE, WEB_TOOLS, chooseRagNotice, citedByPhraseOverlap, createRagSourceTagFilter, formatFullDocumentContext, formatRagContext, isFullTextHit, isWholeDocumentQuery, referencedDocuments, isTruncatedFullTextHit, sourcesFromHits, webSourcesFromToolResult, withoutDataChannel } from './rag/index.ts';
export type { IndexingDevice, IndexingEmbedder, RagExtractors, RagSource, VectorIndex } from './rag/index.ts';
export { attachTurnDocumentIds, groupAttachmentsByMessage } from './records/index.ts';
export { CoreBlobServer, PENDING_BLOB_REFERENCE, isPendingBlobReference, parseBlobReferenceCoreKey } from './store/index.ts';
export type { MeshBlobKeys } from './store/index.ts';
