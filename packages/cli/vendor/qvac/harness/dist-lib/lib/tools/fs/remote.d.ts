import { type DriveOpFn, type GrantedDrive } from './remote-protocol.ts';
import type { HyperRoot } from './scope.ts';
export declare const DRIVE_CALL_TIMEOUT_MS = 20000;
export declare const DRIVE_SEARCH_TIMEOUT_MS: number;
export declare const DRIVE_LIST_PAGE = 256;
export interface RemoteRootsOptions {
    readonly timeoutMs?: number;
    readonly searchTimeoutMs?: number;
}
export declare function createRemoteRoots(drives: readonly GrantedDrive[], driveOp: DriveOpFn, opts?: RemoteRootsOptions): HyperRoot[];
