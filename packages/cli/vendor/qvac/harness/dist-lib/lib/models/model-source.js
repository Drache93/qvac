import { HarnessError } from '../errors.js';
import { audioGenModelByName, curatedListables, curatedModelAsset, customModelSrc } from './model-catalog.js';
const SOURCE_PATTERN = /^(\/|~|\.|file:|https?:|registry:|pear:|hyper:)/;
export async function resolveModelSrc(sdk, model, addon = 'llm') {
    if (SOURCE_PATTERN.test(model)) {
        return model;
    }
    const custom = customModelSrc(model, addon);
    if (custom) {
        return custom;
    }
    if (addon === 'audiogen') {
        const audio = audioGenModelByName(model);
        if (!audio) {
            throw new HarnessError('AUDIOGEN_MODEL_NOT_FOUND', [model]);
        }
        return audio.src;
    }
    const asset = curatedModelAsset(model, addon);
    if (asset) {
        return asset;
    }
    return await registryMatch(sdk, { model, addon, projection: false });
}
export async function resolveProjectionSrc(sdk, model) {
    if (SOURCE_PATTERN.test(model)) {
        return model;
    }
    return await registryMatch(sdk, { model, addon: 'llm', projection: true });
}
async function registryMatch(sdk, { model, addon, projection }) {
    const entries = await sdk.modelRegistrySearch({ filter: model, addon });
    const entry = bestMatch(entries.filter((candidate) => /mmproj/i.test(candidate.name) === projection), model);
    if (!entry) {
        throw new HarnessError('MODEL_NOT_IN_REGISTRY', [model, addon]);
    }
    return { ...entry, src: `registry://${entry.registrySource}/${entry.registryPath}` };
}
function bestMatch(entries, model) {
    const curated = new Set(curatedListables().map((listable) => listable.asset.registryPath));
    return (entries.find((entry) => entry.name === model) ??
        entries.find((entry) => curated.has(entry.registryPath)) ??
        entries[0]);
}
