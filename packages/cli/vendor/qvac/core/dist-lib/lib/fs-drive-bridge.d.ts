import type { DriveOpFn, GrantedDrive } from '@qvac/harness';
import type { AcquiredDrive, DriveHost } from './core/fs-drives.ts';
import type { FsGrant } from './fs-grants.ts';
export declare const DRIVE_OP_TIMEOUT_MS = 15000;
export declare function sweepDriveStaging(now?: number): Promise<void>;
export declare function createDriveOp(drives: ReadonlyMap<string, AcquiredDrive>): DriveOpFn;
export interface ResolvedFsGrants {
    readonly grantedDirs: string[];
    readonly grantedDrives: GrantedDrive[];
    readonly driveOp?: DriveOpFn;
}
export declare function resolveFsGrants(grants: readonly FsGrant[], driveHost: DriveHost | undefined, onDropped?: (key: string, err: unknown) => void): Promise<ResolvedFsGrants>;
