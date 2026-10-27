import { type Drive } from './drive.ts';
import type { DriveResponse, DriveSearchRequest } from './remote-protocol.ts';
import { type DriveRoot } from './scope.ts';
import { type WalkSummary } from './walk.ts';
export declare const MAX_GREP_MATCHES = 1000;
export interface SearchHit {
    file: string;
    line: number;
    text: string;
}
export interface SearchFile {
    path: string;
    key: string;
}
export interface SearchOptions {
    regex?: boolean;
    caseSensitive?: boolean;
    concurrency?: number;
}
export interface SearchResult {
    hits: SearchHit[];
    capped: boolean;
    cut: boolean;
}
export interface FolderSearchOptions {
    maxMatches: number;
    includeIgnored?: boolean;
    maxEntries?: number;
    maxMs?: number;
    deny?: readonly string[];
    include?: ((name: string, path: string) => boolean) | null;
}
export interface FolderSearchResult extends SearchResult, WalkSummary {
}
export declare class DriveSearch {
    #private;
    constructor(queries: readonly string[], { regex, caseSensitive, concurrency }?: SearchOptions);
    static answer(drive: Drive, request: DriveSearchRequest): Promise<DriveResponse>;
    searchFolder(root: DriveRoot, folder: string, { maxMatches, includeIgnored, maxEntries, maxMs, deny, include }: FolderSearchOptions): Promise<FolderSearchResult>;
    search(drive: Drive, files: AsyncIterable<SearchFile>, maxMatches: number): Promise<SearchResult>;
}
