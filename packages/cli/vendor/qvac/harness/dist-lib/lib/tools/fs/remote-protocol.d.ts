import type { SearchHit } from './search.ts';
export interface DriveEntry {
    key: string;
    value: {
        executable: boolean;
        linkname: string | null;
        blob: {
            byteLength: number;
        } | null;
        metadata: unknown;
    };
    mtime?: number;
}
export interface DriveDir {
    key: string;
    dir: true;
}
export interface GrantedDrive {
    readonly key: string;
    readonly writable: boolean;
    readonly search?: boolean;
}
export declare const MAX_DRIVE_BYTES: number;
export interface DriveEntryRequest {
    op: 'entry';
    driveKey: string;
    key: string;
}
export interface DriveGetRequest {
    op: 'get';
    driveKey: string;
    key: string;
}
export interface DriveReadRequest {
    op: 'read';
    driveKey: string;
    key: string;
}
export interface DriveListRequest {
    op: 'list';
    driveKey: string;
    folder: string;
    skip: string[];
    recursive: boolean;
    limit: number;
    cursor: string | null;
}
export interface DriveWriteRequest {
    op: 'write';
    driveKey: string;
    key: string;
    path: string;
    executable?: boolean;
}
export interface DriveSearchQuery {
    folder: string;
    queries: string[];
    regex: boolean;
    caseSensitive: boolean;
    includeIgnored: boolean;
    maxMatches: number;
    maxEntries: number;
    maxMs: number;
}
export interface DriveSearchRequest extends DriveSearchQuery {
    op: 'search';
    driveKey: string;
}
export type DriveRequest = DriveEntryRequest | DriveGetRequest | DriveReadRequest | DriveListRequest | DriveWriteRequest | DriveSearchRequest;
export interface DriveResponse {
    error?: string;
    entry?: DriveEntry | null;
    path?: string | null;
    truncated?: boolean;
    entries?: Array<DriveEntry | DriveDir>;
    cursor?: string | null;
    hits?: SearchHit[];
    capped?: boolean;
    cut?: boolean;
    skippedLinks?: number;
}
export type DriveOpFn = (request: DriveRequest) => Promise<DriveResponse>;
