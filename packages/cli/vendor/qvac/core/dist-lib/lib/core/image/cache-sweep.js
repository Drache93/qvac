import fs from 'fs';
import crypto from 'hypercore-crypto';
import path from 'path';
import b4a from 'b4a';
export const IMAGE_CACHE_MAX_BYTES = 512 * 1024 * 1024;
export const IMAGE_CACHE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const STALE_PARTIAL_MS = 60 * 60 * 1000;
const STAGING_SUFFIX = /\.partial-[0-9a-f]{8}$/;
const CACHE_KEY_CHARS = 32;
export function imageCacheName(image) {
    const name = image.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-40);
    return `${imageCacheKey(image.blobId)}-${name}`;
}
export function imageCacheKey(blobId) {
    return b4a.toHex(crypto.hash(b4a.from(blobId))).slice(0, CACHE_KEY_CHARS);
}
export async function sweepImageCache(dir, { maxBytes = IMAGE_CACHE_MAX_BYTES, maxAgeMs = IMAGE_CACHE_MAX_AGE_MS, keep, inUse } = {}) {
    const names = await fs.promises.readdir(dir).catch(toNull);
    if (!names) {
        return;
    }
    const now = Date.now();
    const entries = [];
    let total = 0;
    for (const entry of await liveEntries(dir, names, now)) {
        total += entry.size;
        if (inUse?.(entry.name)) {
            continue;
        }
        if (keep && !keep.has(entry.name.slice(0, CACHE_KEY_CHARS))) {
            await fs.promises.unlink(entry.file).catch(noop);
            total -= entry.size;
            continue;
        }
        if (now - entry.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(entry.file).catch(noop);
            total -= entry.size;
            continue;
        }
        entries.push(entry);
    }
    if (total <= maxBytes) {
        return;
    }
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const entry of entries) {
        if (total <= maxBytes)
            return;
        if (inUse?.(entry.name))
            continue;
        await fs.promises.unlink(entry.file).catch(noop);
        total -= entry.size;
    }
}
async function liveEntries(dir, names, now) {
    const entries = [];
    for (const name of names) {
        const file = path.join(dir, name);
        const stats = await fs.promises.stat(file).catch(toNull);
        if (!stats?.isFile()) {
            continue;
        }
        if (STAGING_SUFFIX.test(name)) {
            if (now - stats.mtimeMs > STALE_PARTIAL_MS) {
                await fs.promises.unlink(file).catch(noop);
            }
            continue;
        }
        entries.push({ file, name, size: stats.size, mtimeMs: stats.mtimeMs });
    }
    return entries;
}
function toNull() {
    return null;
}
function noop() { }
