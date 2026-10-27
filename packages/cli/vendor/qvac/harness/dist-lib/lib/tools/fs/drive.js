import { HarnessError } from '../../errors.js';
export class DriveReadTruncatedError extends HarnessError {
    constructor(key, bytes) {
        super('DRIVE_READ_TRUNCATED', [bytes, key]);
    }
}
export function isDriveReadTruncated(err) {
    return err instanceof DriveReadTruncatedError;
}
