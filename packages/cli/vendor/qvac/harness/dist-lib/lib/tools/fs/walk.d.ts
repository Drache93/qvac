import { type DriveRoot } from './scope.ts';
export declare const WALK_SKIP_DIRS: Set<string>;
export declare const MAX_WALK_ENTRIES = 10000;
export declare const MAX_WALK_MS = 30000;
export interface WalkedFile {
    path: string;
    key: string;
    byteLength: number;
}
export interface WalkSummary {
    truncated: boolean;
    skippedLinks: number;
}
export interface WalkResult extends WalkSummary {
    files: WalkedFile[];
}
export interface WalkStream {
    files: AsyncIterable<WalkedFile>;
    result: Promise<WalkSummary>;
}
export interface WalkOptions {
    includeIgnored?: boolean;
    maxEntries?: number;
    maxMs?: number;
}
export declare function walkFiles(root: DriveRoot, folder?: string, opts?: WalkOptions): Promise<WalkResult>;
export declare function streamFiles(root: DriveRoot, folder?: string, opts?: WalkOptions): WalkStream;
