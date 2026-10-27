import type { CompiledPolicy } from '../../contract/policy.ts';
import { type DriveRoot, type FsToolError, type Realpath, type ResolvedKey } from './scope.ts';
export interface Grants {
    readonly fsRoots?: readonly DriveRoot[] | undefined;
    readonly fsWriteRoots?: readonly DriveRoot[] | undefined;
    readonly policy?: CompiledPolicy | undefined;
}
export declare function anchorOf(grants: Grants | undefined): DriveRoot | undefined;
export declare function rootedPath(p: string, anchor: DriveRoot | undefined): string;
export declare function shownPath(full: string, anchor: DriveRoot | undefined): string;
export interface RootedScope {
    readonly grants: Grants | undefined;
    readonly write: boolean;
    readonly realpath: Realpath;
    readonly deniedRoots?: readonly string[] | undefined;
}
export declare function resolveRooted(p: string, { grants, write, realpath, deniedRoots }: RootedScope): Promise<ResolvedKey | FsToolError>;
export declare function rootedArgs(args: Record<string, unknown>, grants: Grants | undefined, keys: readonly string[]): string[] | null;
export declare function stringArg(args: Record<string, unknown>, key: string): string | null;
export declare function positiveInt(value: unknown): number | undefined;
export declare function existsNow(p: string | null, grants: Grants | undefined): boolean;
export interface LabelPaths {
    readonly grants: Grants | undefined;
    readonly paths: readonly string[];
}
export declare function rootedLabel(verb: string, { grants, paths }: LabelPaths): string;
export declare function localPathOf(resolved: ResolvedKey): string | null;
