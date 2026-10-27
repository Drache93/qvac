import type { LoggerInterface } from '@qvac/logging';
import type { AbortSignal } from 'bare-abort-controller';
import { type IndexingProgress } from '../rag/index.ts';
import { IndexingClaims } from './claims.ts';
import { ArtifactOwnership, type WrittenArtifact } from './ownership.ts';
import { resolveIndexing } from './protocol.ts';
import type { IndexingSource } from './source.ts';
import { type FileRecord } from '../records/index.ts';
import type { Mesh } from '../../mesh.ts';
import type { LocalWork } from './state.ts';
import type { FileProcessor } from './index.ts';
export interface FileDocumentOptions {
    readonly record: FileRecord;
    readonly processor: FileProcessor;
    readonly source: IndexingSource;
    readonly output: IndexingSource;
    readonly schedule: (deadline: number) => void;
    readonly closed: () => boolean;
    readonly paused: () => boolean;
    readonly progress?: IndexingProgress;
    readonly admit?: () => void;
}
interface SourceReference {
    readonly id: string;
    readonly reference: string;
}
export declare class FileDocument {
    private readonly _mesh;
    readonly record: FileRecord;
    readonly state: ReturnType<Mesh['files']['state']['document']>;
    readonly source: ReturnType<typeof fileSource>;
    readonly claims: {
        markFailed: IndexingClaims['markFailed'];
        isFailed: IndexingClaims['isFailed'];
        blockedByStatus: IndexingClaims['blockedByStatus'];
        claim: (id: string) => ReturnType<IndexingClaims['claim']>;
        lease: IndexingClaims['lease'];
        settle: (id: string) => Promise<void>;
    };
    readonly ownership: ArtifactOwnership;
    readonly schedule: (deadline: number) => void;
    readonly closed: () => boolean;
    readonly paused: () => boolean;
    readonly admit: () => void;
    private readonly _output;
    private _fetched;
    private readonly _progress?;
    private readonly _processor;
    constructor(mesh: Mesh, options: FileDocumentOptions);
    get log(): LoggerInterface | null;
    get localCoreKey(): string;
    artifact(id: string): import("./state.ts").ArtifactState;
    readArtifact(id: string): Readonly<import("./state.ts").ArtifactState> | undefined;
    output(id: string, reference: string): {
        read: (signal?: AbortSignal) => Promise<import("./source.ts").SourceRead>;
        blockedUntil: () => number | null;
        miss: () => number;
        clear: () => void;
    };
    clearFetched(): Promise<void>;
    private _fetching;
    artifacts(): Promise<import("../../../../spec/index").QvacKnowledgeArtifact[]>;
    statuses(): Promise<import("../../../../spec/index").QvacIndexingStatus[]>;
    current(): Promise<FileRecord | null>;
    publish(input: Omit<Parameters<Mesh['files']['publish']>[0], 'knowledgeId'>): Promise<import("../../../../spec/index").QvacKnowledgeArtifact>;
    resolve(input: Parameters<typeof resolveIndexing>[1]): Promise<import("./protocol.ts").IndexingResolutionResult>;
    write(bytes: Buffer): Promise<WrittenArtifact>;
    inline(bytes: Buffer, mimeType: string): string;
    work(state: LocalWork): void;
    load(state: LocalWork, artifactId?: string): void;
    report(update: Omit<Parameters<IndexingProgress>[0], 'knowledgeId' | 'chatId'>): void;
}
declare function fileSource(source: IndexingSource, { id, reference }: SourceReference): {
    read: (signal?: AbortSignal) => Promise<import("./source.ts").SourceRead>;
    blockedUntil: () => number | null;
    miss: () => number;
    clear: () => void;
};
export {};
