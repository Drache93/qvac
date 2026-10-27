import fs from 'fs';
import { platform } from 'os';
import path from 'path';
import process from 'process';
import enginePkg from '@qvac/inference/package' with { type: 'json' };
const OPENCL_CACHE_DIR_ENV = 'QVAC_OPENCL_CACHE_DIR';
export const OPENCL_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const noop = () => { };
export function openclEngineKey(sdkVersion = enginePkg.version) {
    return `sdk-${sdkVersion}`.replace(/[^A-Za-z0-9._-]/g, '_');
}
export function openclCacheRoot(env = process.env, hostPlatform = platform()) {
    if (hostPlatform !== 'android')
        return undefined;
    const dir = env[OPENCL_CACHE_DIR_ENV];
    if (!dir?.startsWith('/')) {
        return undefined;
    }
    return dir.split('/').includes('..') ? undefined : dir;
}
export function openclCacheDir(env = process.env, hostPlatform = platform(), sdkVersion) {
    const root = openclCacheRoot(env, hostPlatform);
    return root === undefined ? undefined : path.join(root, openclEngineKey(sdkVersion));
}
export function prepareOpenclCache(env = process.env, { hostPlatform = platform(), sdkVersion, now = Date.now() } = {}) {
    const root = openclCacheRoot(env, hostPlatform);
    if (root === undefined) {
        return;
    }
    const key = openclEngineKey(sdkVersion);
    try {
        fs.mkdirSync(path.join(root, key), { recursive: true });
    }
    catch {
        return;
    }
    fs.promises.readdir(root).then((names) => {
        for (const name of names) {
            if (name === key)
                continue;
            const entry = path.join(root, name);
            fs.promises
                .stat(entry)
                .then((stat) => {
                if (now - stat.mtimeMs > OPENCL_CACHE_MAX_AGE_MS) {
                    return fs.promises.rm(entry, { recursive: true, force: true }).catch(noop);
                }
            })
                .catch(noop);
        }
    }, noop);
}
