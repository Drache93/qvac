import fs from 'fs';
import path from 'path';
import { pipelinePromise, Readable } from 'streamx';
import { AbortController } from 'bare-abort-controller';
import { STAGING_DIR as HARNESS_STAGING_DIR } from '@qvac/harness/lib/staging.ts';
import { userTmpPath } from '@qvac/harness/lib/tmp-path.ts';
import { errorMessage } from './guards.js';
export const DRIVE_OP_TIMEOUT_MS = 15_000;
const MAX_DRIVE_BYTES = 8 * 1024 * 1024;
const STAGING_DIR = userTmpPath('qvac-fs-drive-host');
const STAGING_MAX_AGE_MS = 60 * 60 * 1000;
const noop = () => { };
export async function sweepDriveStaging(now = Date.now()) {
    const names = await fs.promises.readdir(STAGING_DIR).catch(() => []);
    await Promise.all(names.map(async (name) => {
        const file = path.join(STAGING_DIR, name);
        const stat = await fs.promises.stat(file).catch(noop);
        if (stat && now - stat.mtimeMs > STAGING_MAX_AGE_MS) {
            await fs.promises.unlink(file).catch(noop);
        }
    }));
}
function withDeadline(op, ms, task) {
    const controller = new AbortController();
    const { promise, resolve, reject } = Promise.withResolvers();
    const timer = setTimeout(() => {
        const err = new Error(`drive ${op} timed out on the host`);
        controller.abort(err);
        reject(err);
    }, ms);
    task(controller.signal).then((value) => {
        clearTimeout(timer);
        resolve(value);
    }, (err) => {
        clearTimeout(timer);
        reject(err);
    });
    return promise;
}
async function stagedPath(prefix) {
    await fs.promises.mkdir(STAGING_DIR, { recursive: true, mode: 0o700 });
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return path.join(STAGING_DIR, `${prefix}-${unique}`);
}
function stripMetadata(entry) {
    return { ...entry, value: { ...entry.value, metadata: null } };
}
async function pipeCapped(source, target, { cap, signal }) {
    const sink = fs.createWriteStream(target, { mode: 0o600 });
    let sinkError = null;
    sink.on('error', (err) => {
        sinkError = err;
    });
    let written = 0;
    let truncated = false;
    try {
        for await (const chunk of source) {
            if (signal.aborted)
                break;
            if (sinkError)
                throw sinkError;
            if (written >= cap) {
                truncated = true;
                break;
            }
            const room = cap - written;
            const slice = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
            sink.write(slice);
            written += slice.byteLength;
            if (slice.byteLength < chunk.byteLength) {
                truncated = true;
            }
        }
    }
    finally {
        await new Promise((resolve) => sink.end(resolve));
    }
    if (sinkError) {
        throw sinkError;
    }
    return truncated;
}
function folderRange(folder) {
    const trimmed = folder === '/' ? '' : folder.replace(/\/+$/, '');
    return { gt: `${trimmed}/`, lt: `${trimmed}0` };
}
async function handleRequest(acquired, request, signal) {
    const drive = acquired.drive;
    switch (request.op) {
        case 'entry': {
            const entry = await drive.entry(request.key, { timeout: DRIVE_OP_TIMEOUT_MS, wait: true });
            return { entry: entry ? stripMetadata(entry) : null };
        }
        case 'get': {
            const entry = await drive.entry(request.key, { timeout: DRIVE_OP_TIMEOUT_MS, wait: true });
            if (!entry) {
                return { path: null };
            }
            if ((entry.value.blob?.byteLength ?? 0) > MAX_DRIVE_BYTES) {
                return { error: `get exceeds ${MAX_DRIVE_BYTES} bytes: ${request.key}` };
            }
            const buffer = await drive.get(request.key, { timeout: DRIVE_OP_TIMEOUT_MS, wait: true });
            if (!buffer) {
                return { path: null };
            }
            const target = await stagedPath('drive-get');
            signal.addEventListener('abort', () => void fs.promises.unlink(target).catch(noop), {
                once: true
            });
            await fs.promises.writeFile(target, buffer, { mode: 0o600 });
            return { path: target };
        }
        case 'read': {
            const target = await stagedPath('drive-read');
            signal.addEventListener('abort', () => void fs.promises.unlink(target).catch(noop), {
                once: true
            });
            const truncated = await pipeCapped(drive.createReadStream(request.key), target, {
                cap: MAX_DRIVE_BYTES,
                signal
            });
            return { path: target, truncated };
        }
        case 'list': {
            const skip = new Set(request.skip);
            const entries = [];
            let cursor = null;
            const ignore = (key) => key.split('/').some((seg) => skip.has(seg));
            const range = folderRange(request.folder);
            const gt = request.cursor ?? range.gt;
            for await (const raw of drive.entries({ gt, lt: range.lt }, { ignore })) {
                entries.push(stripMetadata(raw));
                if (entries.length >= request.limit) {
                    cursor = raw.key;
                    break;
                }
            }
            return { entries, cursor };
        }
        case 'write': {
            if (!acquired.writable) {
                return { error: `drive is read-only: cannot write ${request.key}` };
            }
            const resolvedPath = path.resolve(request.path);
            if (path.relative(HARNESS_STAGING_DIR, resolvedPath).startsWith('..')) {
                return { error: `write path is outside the staging directory: ${request.path}` };
            }
            const source = Readable.from(fs.createReadStream(resolvedPath));
            const sink = drive.createWriteStream(request.key, request.executable ? { executable: true } : undefined);
            signal.addEventListener('abort', () => {
                source.destroy();
                sink.destroy();
            }, { once: true });
            await pipelinePromise(source, sink);
            await fs.promises.unlink(resolvedPath).catch(noop);
            return {};
        }
        case 'search': {
            return { error: `drive search is not served: ${request.folder}` };
        }
    }
}
export function createDriveOp(drives) {
    return async (request) => {
        const acquired = drives.get(request.driveKey);
        if (!acquired) {
            return { error: `drive not granted for this run: ${request.driveKey}` };
        }
        try {
            return await withDeadline(request.op, DRIVE_OP_TIMEOUT_MS, (signal) => handleRequest(acquired, request, signal));
        }
        catch (err) {
            return { error: errorMessage(err) };
        }
    };
}
export async function resolveFsGrants(grants, driveHost, onDropped) {
    const grantedDirs = grants
        .filter((grant) => grant.kind === 'local')
        .map((grant) => grant.path);
    const hyperGrants = grants.filter((grant) => grant.kind === 'hyper');
    if (!driveHost || hyperGrants.length === 0) {
        return { grantedDirs, grantedDrives: [] };
    }
    const drives = new Map();
    const grantedDrives = [];
    for (const grant of hyperGrants) {
        try {
            const acquired = await driveHost.acquire(grant.key);
            drives.set(grant.key, acquired);
            grantedDrives.push({ key: grant.key, writable: acquired.writable });
        }
        catch (err) {
            onDropped?.(grant.key, err);
        }
    }
    if (drives.size === 0) {
        return { grantedDirs, grantedDrives: [] };
    }
    return { grantedDirs, grantedDrives, driveOp: createDriveOp(drives) };
}
