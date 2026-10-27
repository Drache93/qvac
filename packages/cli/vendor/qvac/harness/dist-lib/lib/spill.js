import b4a from 'b4a';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { userTmpPath } from './tmp-path.js';
export const SPILL_DIR = userTmpPath('qvac-harness-spill');
export const SPILL_MAX_BYTES = 8 * 1024 * 1024;
export const SPILL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RUN_ID = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const HOP = '+';
const noop = () => { };
export function runSpill(runId, { root = SPILL_DIR, maxBytes = SPILL_MAX_BYTES } = {}) {
    const dir = runDir(runId, root);
    if (dir === null) {
        return undefined;
    }
    return {
        dir,
        sink: (stream) => createSink(dir, stream, maxBytes)
    };
}
export async function reserveSpillFile(dir, name, stream) {
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.promises.mkdir(path.join(dir, name), { mode: 0o700 });
    return path.join(dir, name, `${stream}.txt`);
}
function createSink(dir, stream, maxBytes) {
    let file = null;
    let written = 0;
    let failed = false;
    let closed = false;
    let pending = Promise.resolve();
    const append = (bytes) => async () => {
        if (failed)
            return;
        try {
            file ??= await reserveSpillFile(dir, b4a.toHex(randomBytes(8)), stream);
            await fs.promises.appendFile(file, bytes, { mode: 0o600, flag: 'a' });
        }
        catch {
            failed = true;
        }
    };
    return {
        write(text) {
            if (closed || written >= maxBytes || !text)
                return;
            const bytes = b4a.from(text).subarray(0, maxBytes - written);
            pending = pending.then(append(bytes));
            written += bytes.byteLength;
        },
        async close() {
            closed = true;
            await pending;
            return written > 0 && !failed ? file : null;
        }
    };
}
function runDir(runId, root) {
    const segments = runId.split('/');
    return segments.every((segment) => RUN_ID.test(segment))
        ? path.join(root, segments.join(HOP))
        : null;
}
export async function removeRun(runId, root = SPILL_DIR) {
    const dir = runDir(runId, root);
    if (dir === null) {
        return;
    }
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(noop);
}
export function sweepSpill(now = Date.now(), root = SPILL_DIR) {
    fs.promises.readdir(root).then((names) => {
        for (const name of names) {
            const dir = path.join(root, name);
            fs.promises
                .stat(dir)
                .then((stat) => {
                if (now - stat.mtimeMs > SPILL_MAX_AGE_MS) {
                    return fs.promises.rm(dir, { recursive: true, force: true });
                }
            })
                .catch(noop);
        }
    }, noop);
}
