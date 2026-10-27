import { resolveModelSrc } from './model-source.js';
import { addonTaskType } from './model-task.js';
import { isCustomModelCached } from './custom-model-cache.js';
import { companionRegistryPaths, curatedListables, customModels, musicListables } from './model-catalog.js';
export const MODEL_STATUS_TTL_MS = 30_000;
export function createModelStatusCache() {
    return { entries: new Map(), epoch: 0 };
}
export function invalidateModelStatusCache(cache) {
    cache.entries.clear();
    cache.epoch += 1;
}
const STATUS_CONCURRENCY = 8;
async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
        while (true) {
            const i = cursor++;
            if (i >= items.length) {
                return;
            }
            results[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}
const COMPANIONS_BY_WEIGHT = companionRegistryPaths();
async function musicRows(hydrate) {
    const rows = [];
    for (const listable of musicListables()) {
        const status = await hydrate(listable.asset.registryPath, listable.asset.name);
        let companionsCached = true;
        for (const companion of listable.companions) {
            companionsCached =
                (await hydrate(companion.registryPath, companion.name)).isCached && companionsCached;
        }
        rows.push({
            name: listable.name,
            type: 'audiogen',
            registryPath: listable.asset.registryPath,
            registrySource: listable.asset.registrySource,
            isCached: status.isCached && companionsCached,
            isLoaded: status.isLoaded,
            supportsImages: false,
            expectedSize: listable.expectedSize,
            taskType: addonTaskType('audiogen')
        });
    }
    return rows;
}
export async function listModels(sdk, { type, cachedOnly, fullRegistry } = {}, { cache, projectionFor } = {}) {
    const now = Date.now();
    const seesImages = (name, addon) => addon === 'llm' && Boolean(projectionFor?.(name));
    const hydrate = async (registryPath, catalogName) => {
        const hit = cache?.entries.get(registryPath);
        if (hit && now - hit.at < MODEL_STATUS_TTL_MS) {
            return hit;
        }
        const epoch = cache?.epoch;
        const info = catalogName
            ? await sdk.getModelInfo({ name: catalogName }).catch(() => null)
            : null;
        const status = {
            at: now,
            isCached: info?.isCached ?? false,
            isLoaded: info?.isLoaded ?? false,
            expectedSize: info?.expectedSize,
            actualSize: info?.actualSize
        };
        if (cache && cache.epoch === epoch) {
            cache.entries.set(registryPath, status);
        }
        return status;
    };
    if (!fullRegistry) {
        const listables = curatedListables().filter((listable) => !type || listable.asset.addon === type);
        const rows = await mapPool(listables, STATUS_CONCURRENCY, async (listable) => {
            const status = await hydrate(listable.asset.registryPath, listable.asset.name);
            let companionsCached = true;
            for (const companion of listable.companions) {
                companionsCached =
                    (await hydrate(companion.registryPath, companion.name)).isCached && companionsCached;
            }
            if (listable.projection && projectionFor?.(listable.name) === listable.projection.src) {
                const projection = await hydrate(listable.projection.registryPath, listable.projection.name);
                companionsCached = projection.isCached && companionsCached;
            }
            return {
                name: listable.name,
                type: listable.asset.addon,
                registryPath: listable.asset.registryPath,
                registrySource: listable.asset.registrySource,
                isCached: status.isCached && companionsCached,
                isLoaded: status.isLoaded,
                supportsImages: seesImages(listable.name, listable.asset.addon),
                expectedSize: status.expectedSize ?? listable.asset.expectedSize,
                actualSize: status.actualSize,
                taskType: addonTaskType(listable.asset.addon)
            };
        });
        const music = !type || type === 'audiogen' ? await musicRows(hydrate) : [];
        const all = [...rows, ...music];
        return cachedOnly ? all.filter((row) => row.isCached) : all;
    }
    const entries = await sdk.modelRegistrySearch(type ? { addon: type } : {});
    const catalog = new Map();
    for (const c of sdk.models) {
        catalog.set(c.registryPath, c.name);
    }
    const rows = await mapPool(entries, STATUS_CONCURRENCY, async (entry) => {
        const status = await hydrate(entry.registryPath, catalog.get(entry.registryPath));
        const companions = COMPANIONS_BY_WEIGHT.get(entry.registryPath) ?? [];
        let companionsCached = true;
        for (const path of companions) {
            companionsCached = (await hydrate(path, catalog.get(path))).isCached && companionsCached;
        }
        return {
            name: entry.name,
            type: entry.addon,
            registryPath: entry.registryPath,
            registrySource: entry.registrySource,
            isCached: status.isCached && companionsCached,
            isLoaded: status.isLoaded,
            supportsImages: seesImages(entry.name, entry.addon),
            expectedSize: status.expectedSize ?? entry.expectedSize,
            actualSize: status.actualSize,
            taskType: addonTaskType(entry.addon)
        };
    });
    return cachedOnly ? rows.filter((row) => row.isCached) : rows;
}
export async function customModelRows({ type, cachedOnly }, { modelsDir, loaded }) {
    const entries = customModels().filter((entry) => !type || (entry.taskType ?? 'llm') === type);
    const rows = await Promise.all(entries.map(async (entry) => {
        const addon = entry.taskType ?? 'llm';
        return {
            name: entry.name,
            type: addon,
            registryPath: entry.src,
            registrySource: 'custom',
            isCached: await isCustomModelCached(entry, modelsDir),
            isLoaded: loaded.has(entry.name),
            supportsImages: addon === 'llm' && Boolean(entry.projectionSrc),
            expectedSize: entry.expectedSize ?? 0,
            label: entry.label,
            taskType: addonTaskType(addon)
        };
    }));
    return cachedOnly ? rows.filter((row) => row.isCached) : rows;
}
export function mergeCustomRows(catalog, custom) {
    const shadowed = new Set(custom.map((row) => row.name));
    return [...catalog.filter((row) => !shadowed.has(row.name)), ...custom];
}
export async function isModelSourceCached(sdk, { model, addon, modelsDir }) {
    const src = await resolveModelSrc(sdk, model, addon).catch(() => null);
    if (src === null) {
        return false;
    }
    const name = registryCatalogName(sdk, src);
    if (name === undefined) {
        return typeof src === 'string' && isCustomModelCached({ name: model, src }, modelsDir);
    }
    const info = await sdk.getModelInfo({ name }).catch(() => null);
    return info?.isCached ?? false;
}
function registryCatalogName(sdk, src) {
    if (typeof src !== 'string') {
        return sdk.models.find((entry) => entry.registryPath === src.registryPath)?.name ?? src.name;
    }
    const registryPath = /^registry:\/\/[^/]+\/(.+)$/.exec(src)?.[1];
    if (registryPath === undefined) {
        return undefined;
    }
    return sdk.models.find((entry) => entry.registryPath === registryPath)?.name;
}
