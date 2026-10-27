import type { AssistantFileProcessorStatus } from '../../../../spec/hyperschema/types.d.ts';
import type { IndexingProgress } from '../rag/index.ts';
export type LocalWork = Pick<AssistantFileProcessorStatus, 'state' | 'reason' | 'retryAt'>;
export type IndexingProgressEntry = Omit<Parameters<IndexingProgress>[0], 'error'> & {
    error: string | null;
};
export type ChatProgressEntry = IndexingProgressEntry & {
    readonly chatId: string;
};
export interface LoadedArtifact {
    artifactId: string;
    blobRef?: string;
    evict?: string;
}
interface DocumentState {
    work?: LocalWork;
    load?: LocalWork;
    progress?: IndexingProgressEntry;
    loaded?: LoadedArtifact;
    sourceMisses?: number;
    artifactIdMemo?: string;
    embedFailures?: number;
    preferredUntil?: number;
}
export interface ArtifactState {
    knowledgeId?: string;
    terminal?: boolean;
    failedReference?: string;
    unavailable?: {
        blobRef: string;
        repeated: boolean;
    };
    rebuildFailures?: number;
    published?: {
        artifactBlobId: string;
    };
}
export interface RetryEntry {
    at: number;
    delay: number;
}
export declare class FileRetries {
    private readonly _entries;
    private readonly _missing;
    blockedUntil(id: string, now: number): number | null;
    miss(id: string, now: number, retryMs: number): number;
    markMissing(id: string): void;
    markFound(id: string): void;
    clear(id?: string): void;
    reconnect(onRetry?: (id: string, deadline: number) => void): number | null;
    get(id: string): Readonly<RetryEntry> | undefined;
    rewind(id: string): void;
}
export declare class FileState {
    private readonly _documents;
    private readonly _artifacts;
    readonly sourceRetries: FileRetries;
    readonly outputRetries: FileRetries;
    document(id: string): DocumentState;
    artifact(id: string): ArtifactState;
    forget(id: string): DocumentState | undefined;
    get(id: string): Readonly<DocumentState> | undefined;
    readArtifact(id: string): Readonly<ArtifactState> | undefined;
    progress(chatId: string): ChatProgressEntry[];
    clearLoaded(): void;
    retry(id: string): void;
    reset(): void;
    close(): void;
}
export {};
