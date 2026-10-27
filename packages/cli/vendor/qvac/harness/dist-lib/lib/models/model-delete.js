import fs from 'fs';
import { customDownloads } from './custom-model-cache.js';
import { curatedListables, customModels, musicListables } from './model-catalog.js';
export function summarizeDelete(result) {
    return { name: result.name, removed: result.removed.length, freedBytes: result.freedBytes };
}
export async function deleteModelFiles(sdk, name, { modelsDir } = {}) {
    const custom = customModels().find((entry) => entry.name === name);
    const { files, dirs } = custom
        ? await customDownloads(custom, modelsDir)
        : { files: await catalogFiles(sdk, name), dirs: [] };
    const removed = [];
    for (const filePath of new Set(files)) {
        const bytes = await onDiskSize(filePath);
        if (bytes === null) {
            continue;
        }
        await fs.promises.rm(filePath, { force: true });
        removed.push({ path: filePath, bytes });
    }
    for (const dir of dirs) {
        await fs.promises.rm(dir, { recursive: true, force: true });
    }
    return { name, removed, freedBytes: removed.reduce((sum, file) => sum + file.bytes, 0) };
}
async function catalogFiles(sdk, name) {
    const paths = [];
    for (const catalogName of namesToPurge(name)) {
        const info = await sdk.getModelInfo({ name: catalogName }).catch(() => null);
        if (!info) {
            continue;
        }
        for (const file of info.cacheFiles) {
            paths.push(file.path);
        }
    }
    return paths;
}
async function onDiskSize(filePath) {
    try {
        const stat = await fs.promises.stat(filePath);
        return stat.isFile() ? stat.size : null;
    }
    catch {
        return null;
    }
}
function namesToPurge(name) {
    const curated = curatedListables().find((entry) => entry.name === name || entry.asset.name === name);
    if (curated) {
        const names = [curated.asset.name, ...curated.companions.map((companion) => companion.name)];
        if (curated.projection) {
            names.push(curated.projection.name);
        }
        return names;
    }
    const music = musicListables().find((entry) => entry.name === name || entry.asset.name === name);
    if (music) {
        return [music.asset.name, ...music.companions.map((stage) => stage.name)];
    }
    return [name];
}
