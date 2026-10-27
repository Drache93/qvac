import fs from 'fs';
import path from 'path';
import { userTmpPath } from './tmp-path.js';
export const STAGING_DIR = userTmpPath('qvac-harness-staging');
export const STAGING_MAX_AGE_MS = 60 * 60 * 1000;
const noop = () => { };
export async function stageFile(prefix, bytes) {
    await fs.promises.mkdir(STAGING_DIR, { recursive: true, mode: 0o700 });
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const file = path.join(STAGING_DIR, `${prefix}-${unique}`);
    await fs.promises.writeFile(file, bytes, { mode: 0o600 });
    return file;
}
export function sweepStaging(now = Date.now()) {
    fs.promises.readdir(STAGING_DIR).then((names) => {
        for (const name of names) {
            const file = path.join(STAGING_DIR, name);
            fs.promises
                .stat(file)
                .then((stat) => {
                if (now - stat.mtimeMs > STAGING_MAX_AGE_MS) {
                    return fs.promises.unlink(file).catch(noop);
                }
            })
                .catch(noop);
        }
    }, noop);
}
