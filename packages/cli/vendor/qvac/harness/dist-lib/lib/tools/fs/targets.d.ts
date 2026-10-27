import { type DriveRoot, type FsToolError, type ResolveKeyOptions } from './scope.ts';
export interface SearchTarget {
    root: DriveRoot;
    folder: string;
}
export interface ResolvedTargets {
    targets: SearchTarget[];
}
export declare function searchTargets(dir: unknown, roots: readonly DriveRoot[], { realpath, deny }: ResolveKeyOptions): Promise<ResolvedTargets | FsToolError>;
export declare function relativeKey(key: string, folder: string): string;
