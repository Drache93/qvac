import type { Writable } from 'streamx';
import { HarnessError } from '../../errors.ts';
import type { DriveDir, DriveEntry } from './remote-protocol.ts';
export interface DriveListOptions {
    skip?: ReadonlySet<string>;
    recursive?: boolean;
}
export interface Drive {
    entry(key: string, opts?: {
        follow?: boolean;
    }): Promise<DriveEntry | null>;
    get(key: string): Promise<Uint8Array | null>;
    list(folder?: string, opts?: DriveListOptions): AsyncIterable<DriveEntry | DriveDir>;
    createReadStream(key: string): AsyncIterable<Uint8Array>;
    createWriteStream(key: string, opts?: {
        executable?: boolean;
    }): Writable;
}
export declare class DriveReadTruncatedError extends HarnessError<'DRIVE_READ_TRUNCATED'> {
    constructor(key: string, bytes: number);
}
export declare function isDriveReadTruncated(err: unknown): err is DriveReadTruncatedError;
