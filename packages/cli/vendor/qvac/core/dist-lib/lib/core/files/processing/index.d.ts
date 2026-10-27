import { type AbortSignal } from 'bare-abort-controller';
import { type IndexingProgress } from '../rag/index.ts';
import type { IndexingDevice } from '../rag/policy.ts';
import { type FileInput, type FileRecord } from '../records/index.ts';
import type { Mesh } from '../../mesh.ts';
import { FileDocument } from './document.ts';
import type { LoadedArtifact } from './state.ts';
import type { QvacKnowledgeArtifact } from '../../../../spec/mesh/hyperschema/types.d.ts';
export interface ProcessorHost {
    readonly mesh: Mesh;
    readonly deviceId: Buffer | null;
    readonly device?: IndexingDevice;
}
export interface FileProcessor {
    readonly id: string;
    readonly version: string;
    readonly input: FileInput;
    readonly output: 'blob' | 'inline';
    readonly mediaKind?: string;
    accepts?(output: QvacKnowledgeArtifact, document: FileRecord): boolean;
    applies(document: FileRecord): boolean;
    canProduce(document: FileRecord, host: ProcessorHost): boolean | Promise<boolean>;
    produce(document: FileDocument, signal: AbortSignal): Promise<void>;
    load?(document: FileDocument, signal: AbortSignal): Promise<void>;
    evict?(loaded: LoadedArtifact): Promise<void>;
    close(): Promise<boolean>;
}
export interface FileProcessingOptions {
    readonly processor: FileProcessor;
    readonly deviceId: Buffer | null;
    readonly device?: IndexingDevice;
    readonly retryMs?: number;
    readonly progress?: IndexingProgress;
}
export interface EnqueueOptions {
    readonly wait?: boolean;
}
export declare class FileProcessing {
    private readonly _mesh;
    private readonly _processor;
    private readonly _deviceId;
    private readonly _device?;
    private readonly _source;
    private readonly _output;
    private readonly _progress?;
    private readonly _lanes;
    private readonly _deadlines;
    private readonly _scheduler;
    private _scanning;
    private _dirty;
    private _paused;
    private _closed;
    private _close;
    private _indexCleared;
    private readonly _onDirty;
    private readonly _onAll;
    constructor(mesh: Mesh, options: FileProcessingOptions);
    start(): void;
    suspend(): Promise<void>;
    resume(): void;
    reconnect(): void;
    rescan(): void;
    close(): Promise<void>;
    get indexCleared(): boolean;
    settle(): Promise<void>;
    enqueue(ids: Iterable<string>, options?: EnqueueOptions): Promise<void>;
    private _enqueue;
    get active(): boolean;
    pending(id: string): boolean;
    prioritize(ids: string[]): void;
    private _shutdown;
    private _stop;
    private _kick;
    private _scan;
    private _documents;
    private _pump;
    private _forget;
    private _run;
    private _recordFailure;
    private _queueLoad;
    private _schedule;
    private _retry;
}
export type { FileDocument } from './document.ts';
export { isClaimLive, listIndexingByChat, listIndexingByKnowledge } from './protocol.ts';
export { FileState } from './state.ts';
export type { IndexingProgressEntry, LocalWork } from './state.ts';
export { settleFiles } from './settle.ts';
