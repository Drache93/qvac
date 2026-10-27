import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isRemoteSource, localSourcePath } from './gguf-header.js';
import { shardSet } from './shards.js';
const ARCHIVE = /\.(tar|tgz|zip)(\.\w+)?$/i;
export function customFileCachePath(src, modelsDir) {
    if (!isRemoteSource(src)) {
        return localSourcePath(src);
    }
    const filename = filenameOf(src);
    if (!modelsDir || shardSet(src) || ARCHIVE.test(filename)) {
        return null;
    }
    return path.join(modelsDir, `${shortHash(src)}_${filename}`);
}
export function customShardCache(src, modelsDir) {
    const set = shardSet(src);
    if (!modelsDir || !isRemoteSource(src) || !set) {
        return null;
    }
    const dir = path.join(modelsDir, 'sharded', shortHash(`${set.baseUrl}/${set.base}`));
    return { dir, files: set.shards.map((shard) => path.join(dir, shard.filename)) };
}
export async function customDownloads(entry, modelsDir) {
    const remote = sourcesOf(entry).filter(isRemoteSource);
    const shardDirs = remote.flatMap((src) => customShardCache(src, modelsDir)?.dir ?? []);
    const inShardDirs = await Promise.all(shardDirs.map(listFiles));
    const singles = remote.flatMap((src) => customFileCachePath(src, modelsDir) ?? []);
    return { files: [...singles, ...inShardDirs.flat()], dirs: shardDirs };
}
export async function isCustomModelCached(entry, modelsDir) {
    const expected = sourcesOf(entry).flatMap((src) => customShardCache(src, modelsDir)?.files ?? [customFileCachePath(src, modelsDir)]);
    const sizes = await Promise.all(expected.map(onDiskSize));
    const present = sizes.filter((size) => size !== null);
    if (present.length < sizes.length) {
        return false;
    }
    const total = present.reduce((sum, size) => sum + size, 0);
    return entry.expectedSize ? total === entry.expectedSize : true;
}
function sourcesOf(entry) {
    return entry.projectionSrc ? [entry.src, entry.projectionSrc] : [entry.src];
}
function filenameOf(src) {
    return src.split('/').pop()?.split('?')[0] || 'model.gguf';
}
function shortHash(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}
async function listFiles(dir) {
    try {
        const names = await fs.promises.readdir(dir);
        return names.map((name) => path.join(dir, String(name)));
    }
    catch {
        return [];
    }
}
async function onDiskSize(file) {
    if (file === null)
        return null;
    try {
        const stat = await fs.promises.stat(file);
        return stat.isFile() ? stat.size : null;
    }
    catch {
        return null;
    }
}
