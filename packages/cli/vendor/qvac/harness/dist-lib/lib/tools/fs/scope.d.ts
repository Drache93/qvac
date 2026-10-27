import type { CompiledPolicy } from '../../contract/policy.ts';
import type { Drive } from './drive.ts';
import type { DriveSearchQuery } from './remote-protocol.ts';
import type { FolderSearchResult } from './search.ts';
export type Realpath = (p: string) => Promise<string>;
export declare const defaultRealpath: Realpath;
export interface LocalRoot {
    readonly kind: 'local';
    readonly root: string;
    readonly drive: Drive;
}
export interface HyperRoot {
    readonly kind: 'hyper';
    readonly key: string;
    readonly writable: boolean;
    readonly prefix: string;
    readonly drive: Drive;
    readonly search?: (query: DriveSearchQuery) => Promise<FolderSearchResult>;
}
export type DriveRoot = LocalRoot | HyperRoot;
export interface FsToolOptions {
    readonly realpath?: Realpath;
    readonly deniedRoots?: readonly string[];
}
export declare const NO_DIRS_GRANTED = "no directories are granted";
export interface FsToolError {
    error: string;
}
export declare function deniedRootsFor(sdkHome: string | undefined): readonly string[];
export declare const PROTECTED_PATH_ERROR = "path is inside a protected app directory";
export declare function canonicalDenyRoots(deniedRoots: readonly string[] | undefined, realpath: Realpath): Promise<readonly string[]>;
export declare function callDenyRoots(deniedRoots: readonly string[] | undefined, policy: CompiledPolicy | undefined, realpath: Realpath): Promise<readonly string[]>;
export declare function isDeniedPath(hostPath: string, canonicalDenyRoots: readonly string[]): boolean;
export declare function overlaps(a: string, b: string): boolean;
export declare function hostPath(root: LocalRoot, key: string): string;
export declare function displayPath(root: DriveRoot, key: string): string;
export declare function normalizeDriveKey(prefix: string, input: string): string | null;
export interface ResolvedKey {
    root: DriveRoot;
    key: string;
    exists: boolean;
}
export interface ResolveKeyOptions {
    readonly realpath: Realpath;
    readonly deny?: readonly string[];
}
export declare function resolveKey(p: string, roots: readonly DriveRoot[], { realpath, deny }: ResolveKeyOptions): Promise<ResolvedKey | FsToolError>;
