import fs from 'fs';
import path from 'path';
import { Writable } from 'streamx';
import { HarnessError } from '../../errors.js';
import { DriveReadTruncatedError } from './drive.js';
import { MAX_DRIVE_BYTES } from './remote-protocol.js';
import { MAX_WALK_MS } from './walk.js';
import { STAGING_DIR } from '../../staging.js';
export const DRIVE_CALL_TIMEOUT_MS = 20_000;
export const DRIVE_SEARCH_TIMEOUT_MS = MAX_WALK_MS + DRIVE_CALL_TIMEOUT_MS;
export const DRIVE_LIST_PAGE = 256;
const noop = () => { };
function withTimeout(promise, ms, op) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new HarnessError('DRIVE_TIMED_OUT', [op])), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
async function call(driveOp, request, timeoutMs) {
    const response = await withTimeout(driveOp(request), timeoutMs, request.op);
    if (response.error) {
        throw new Error(response.error);
    }
    return response;
}
async function readStaged(stagedPath) {
    try {
        return await fs.promises.readFile(stagedPath);
    }
    finally {
        await fs.promises.unlink(stagedPath).catch(noop);
    }
}
function stagedWritePath() {
    fs.mkdirSync(STAGING_DIR, { recursive: true, mode: 0o700 });
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return path.join(STAGING_DIR, `drive-write-${unique}`);
}
function remoteDrive(driveKey, driveOp, timeoutMs) {
    return {
        async entry(entryKey) {
            const response = await call(driveOp, { op: 'entry', driveKey, key: entryKey }, timeoutMs);
            return response.entry ?? null;
        },
        async get(getKey) {
            const response = await call(driveOp, { op: 'get', driveKey, key: getKey }, timeoutMs);
            if (!response.path) {
                return null;
            }
            return readStaged(response.path);
        },
        async *list(folder = '/', opts) {
            const skip = [...(opts?.skip ?? [])];
            const recursive = opts?.recursive ?? true;
            let cursor = null;
            while (true) {
                const response = await call(driveOp, { op: 'list', driveKey, folder, skip, recursive, limit: DRIVE_LIST_PAGE, cursor }, timeoutMs);
                const entries = response.entries ?? [];
                for (const entry of entries) {
                    yield entry;
                }
                if (!response.cursor || entries.length === 0) {
                    return;
                }
                cursor = response.cursor;
            }
        },
        async *createReadStream(readKey) {
            const response = await call(driveOp, { op: 'read', driveKey, key: readKey }, timeoutMs);
            if (!response.path) {
                return;
            }
            try {
                yield* fs.createReadStream(response.path);
            }
            finally {
                await fs.promises.unlink(response.path).catch(noop);
            }
            if (response.truncated) {
                throw new DriveReadTruncatedError(readKey, MAX_DRIVE_BYTES);
            }
        },
        createWriteStream(writeKey, writeOpts) {
            const stagedPath = stagedWritePath();
            const sink = fs.createWriteStream(stagedPath, { mode: 0o600 });
            let sinkError = null;
            sink.on('error', (err) => {
                sinkError = err;
            });
            return new Writable({
                write(data, cb) {
                    sink.write(data, (err) => cb(err ?? null));
                },
                final(cb) {
                    sink.end();
                    sink.on('close', () => {
                        if (sinkError) {
                            fs.promises.unlink(stagedPath).catch(noop);
                            cb(sinkError);
                            return;
                        }
                        call(driveOp, {
                            op: 'write',
                            driveKey,
                            key: writeKey,
                            path: stagedPath,
                            executable: writeOpts?.executable || undefined
                        }, timeoutMs).then(() => cb(null), (err) => {
                            fs.promises.unlink(stagedPath).catch(noop);
                            cb(err);
                        });
                    });
                }
            });
        }
    };
}
function remoteSearch(driveKey, driveOp, timeoutMs) {
    return async (query) => {
        const response = await call(driveOp, { op: 'search', driveKey, ...query }, timeoutMs);
        return {
            hits: response.hits ?? [],
            capped: response.capped === true,
            cut: response.cut === true,
            truncated: response.truncated === true,
            skippedLinks: response.skippedLinks ?? 0
        };
    };
}
export function createRemoteRoots(drives, driveOp, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? DRIVE_CALL_TIMEOUT_MS;
    const searchTimeoutMs = opts.searchTimeoutMs ?? DRIVE_SEARCH_TIMEOUT_MS;
    return drives.map((drive) => ({
        kind: 'hyper',
        key: drive.key,
        writable: drive.writable,
        prefix: '/',
        drive: remoteDrive(drive.key, driveOp, timeoutMs),
        search: drive.search ? remoteSearch(drive.key, driveOp, searchTimeoutMs) : undefined
    }));
}
