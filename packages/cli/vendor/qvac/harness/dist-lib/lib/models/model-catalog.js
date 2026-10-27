import { AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0, AUDIOGEN_ACESTEP_V15_BASE_Q4_K_M, AUDIOGEN_ACESTEP_V15_SFT_Q8_0, AUDIOGEN_ACESTEP_V15_TURBO_Q4_K_M, AUDIOGEN_ACESTEP_V15_TURBO_Q8_0, AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0, AUDIOGEN_VAE_BF16, EMBEDDINGGEMMA_300M_Q4_0, FLUX_2_KLEIN_4B_Q4_0, FLUX_2_KLEIN_4B_VAE, HEALTHCARE_1_7B_MEDICAL_Q4_K_M, HEALTHCARE_4B_MEDICAL_Q4_K_M, MMPROJ_QWEN3_5_2B_MULTIMODAL_Q8_0, MMPROJ_QWEN3_5_4B_MULTIMODAL_Q8_0, MMPROJ_QWEN3_5_9B_MULTIMODAL_F16, MMPROJ_QWEN3_6_27B_MULTIMODAL_F16, MMPROJ_QWEN3_6_35B_A3B_MULTIMODAL_F16, MMPROJ_QWEN3_8_27B_MULTIMODAL_F16, MMPROJ_TERNARY_BONSAI_2_27B_MULTIMODAL_Q8_0, QWEN3_5_2B_MULTIMODAL_Q4_K_M, QWEN3_5_4B_MULTIMODAL_Q4_K_M, QWEN3_5_9B_MULTIMODAL_Q4_K_M, PARAKEET_TDT_0_6B_V3_Q8_0, PARAKEET_TDT_1_1B_Q8_0, QWEN3_4B_Q4_K_M, QWEN3_6_27B_MULTIMODAL_Q4_K_XL, QWEN3_6_35B_A3B_MULTIMODAL_Q4_K_M, QWEN3_8_27B_MULTIMODAL_UD_Q4_K_XL, SD_V2_1_1B_Q8_0, SDXL_BASE_1_0_3B_Q4_0, TERNARY_BONSAI_2_27B_MULTIMODAL_PQ2_0, TERNARY_BONSAI_2_27B_MULTIMODAL_PTQ1_0, TTS_CODEC_DECODER_MOSS_TTS_F16, TTS_CODEC_ENCODER_MOSS_TTS_F16, TTS_DELAY_LLM_MOSS_TTS_F16, TTS_MULTILINGUAL_SUPERTONIC3_FP16, TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, TTS_MULTILINGUAL_SUPERTONIC3_Q8_0 } from '@qvac/inference/models';
import { detectToolDialect } from './tool-dialect.js';
import { defaultTtsModelName } from './tts-model-default.js';
import { CAPABILITY_PROFILE_ORDER, QWEN_35_2B, QWEN_35_4B, QWEN_35_9B, QWEN_36_27B, QWEN_36_35B_A3B, QWEN_38_27B, BONSAI_2_27B_PQ2, BONSAI_2_27B_PTQ1, MEDPSY_1_7B, MEDPSY_4B, isCapabilityProfile, meetsMinCapabilityProfile, modelNameToCapabilityProfile, capabilityProfileToModelName, isMultimodalLlm, AGENT_MODEL_NAMES, modelDisplayName, capabilityProfileModelLabel, DEFAULT_IMAGE_MODEL_CHOICE, IMAGE_CHOICE_CATALOG, isMobilePlatform, runnableModelName } from './model-catalog-constants.js';
export { CAPABILITY_PROFILE_ORDER, QWEN_35_2B, QWEN_35_4B, QWEN_35_9B, QWEN_36_27B, QWEN_36_35B_A3B, QWEN_38_27B, BONSAI_2_27B_PQ2, BONSAI_2_27B_PTQ1, MEDPSY_1_7B, MEDPSY_4B, isCapabilityProfile, meetsMinCapabilityProfile, modelNameToCapabilityProfile, capabilityProfileToModelName, isMultimodalLlm, AGENT_MODEL_NAMES, modelDisplayName, capabilityProfileModelLabel, DEFAULT_IMAGE_MODEL_CHOICE, IMAGE_CHOICE_CATALOG, isMobilePlatform, runnableModelName };
export const LLM_CATALOG = [
    {
        name: QWEN_35_2B,
        weight: QWEN3_5_2B_MULTIMODAL_Q4_K_M,
        capabilityProfile: 'low',
        projection: MMPROJ_QWEN3_5_2B_MULTIMODAL_Q8_0
    },
    {
        name: QWEN_35_4B,
        weight: QWEN3_5_4B_MULTIMODAL_Q4_K_M,
        capabilityProfile: 'mid',
        projection: MMPROJ_QWEN3_5_4B_MULTIMODAL_Q8_0
    },
    {
        name: QWEN_35_9B,
        weight: QWEN3_5_9B_MULTIMODAL_Q4_K_M,
        capabilityProfile: 'high',
        projection: MMPROJ_QWEN3_5_9B_MULTIMODAL_F16
    },
    {
        name: QWEN_36_27B,
        weight: QWEN3_6_27B_MULTIMODAL_Q4_K_XL,
        capabilityProfile: 'xhigh',
        projection: MMPROJ_QWEN3_6_27B_MULTIMODAL_F16
    },
    {
        name: QWEN_36_35B_A3B,
        weight: QWEN3_6_35B_A3B_MULTIMODAL_Q4_K_M,
        capabilityProfile: 'xhigh',
        projection: MMPROJ_QWEN3_6_35B_A3B_MULTIMODAL_F16
    },
    {
        name: MEDPSY_1_7B,
        weight: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
        capabilityProfile: 'low',
        textOnly: true
    },
    {
        name: MEDPSY_4B,
        weight: HEALTHCARE_4B_MEDICAL_Q4_K_M,
        capabilityProfile: 'mid',
        textOnly: true
    },
    {
        name: QWEN_38_27B,
        weight: QWEN3_8_27B_MULTIMODAL_UD_Q4_K_XL,
        capabilityProfile: 'xhigh',
        projection: MMPROJ_QWEN3_8_27B_MULTIMODAL_F16
    },
    {
        name: BONSAI_2_27B_PQ2,
        weight: TERNARY_BONSAI_2_27B_MULTIMODAL_PQ2_0,
        capabilityProfile: 'high',
        projection: MMPROJ_TERNARY_BONSAI_2_27B_MULTIMODAL_Q8_0,
        toolDialect: 'qwen35'
    },
    {
        name: BONSAI_2_27B_PTQ1,
        weight: TERNARY_BONSAI_2_27B_MULTIMODAL_PTQ1_0,
        capabilityProfile: 'high',
        projection: MMPROJ_TERNARY_BONSAI_2_27B_MULTIMODAL_Q8_0,
        toolDialect: 'qwen35'
    }
];
export function defaultProjectionMap() {
    const map = {};
    for (const entry of LLM_CATALOG) {
        if (entry.projection) {
            map[entry.name] = entry.projection.src;
        }
    }
    return map;
}
const TTS_FULL_STEPS = { ttsNumInferenceSteps: 16 };
export const MOSS_TTS = {
    name: 'MOSS-TTS-8B-F16',
    category: 'tts',
    asset: TTS_DELAY_LLM_MOSS_TTS_F16,
    companions: [TTS_CODEC_DECODER_MOSS_TTS_F16],
    modelConfig: {
        ttsEngine: 'moss',
        language: 'en',
        mossCodecDecoderModelSrc: TTS_CODEC_DECODER_MOSS_TTS_F16.src,
        streamChunkTokens: 25,
        useGPU: true
    }
};
export const MOSS_CODEC_ENCODER_SRC = TTS_CODEC_ENCODER_MOSS_TTS_F16.src;
export const CATEGORY_DEFAULTS = [
    { name: 'Supertonic3-Q4_0', category: 'tts', asset: TTS_MULTILINGUAL_SUPERTONIC3_Q4_0 },
    {
        name: 'Supertonic3-Q8_0',
        category: 'tts',
        asset: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
        modelConfig: TTS_FULL_STEPS
    },
    {
        name: 'Supertonic3-FP16',
        category: 'tts',
        asset: TTS_MULTILINGUAL_SUPERTONIC3_FP16,
        modelConfig: TTS_FULL_STEPS
    },
    MOSS_TTS,
    {
        name: 'Parakeet-TDT-0.6B-v3-Q8_0',
        category: 'transcription',
        asset: PARAKEET_TDT_0_6B_V3_Q8_0
    },
    {
        name: 'Parakeet-TDT-1.1B-Q8_0',
        category: 'transcription',
        asset: PARAKEET_TDT_1_1B_Q8_0
    },
    { name: 'EmbeddingGemma-300M-Q4_0', category: 'embedding', asset: EMBEDDINGGEMMA_300M_Q4_0 }
];
export function categoryModelConfig(modelSrc) {
    const src = typeof modelSrc === 'string' ? modelSrc : modelSrc.src;
    return CATEGORY_DEFAULTS.find((entry) => entry.asset.src === src)?.modelConfig;
}
export function categoryDownloadMetadata(model, addon) {
    const entry = CATEGORY_DEFAULTS.find((candidate) => candidate.asset.addon === addon && (candidate.name === model || candidate.asset.src === model));
    if (!entry?.companions) {
        return undefined;
    }
    const assets = [entry.asset, ...entry.companions];
    return {
        companions: entry.companions.map((asset) => asset.src),
        assetSizes: Object.fromEntries(assets.map((asset) => [asset.src, asset.expectedSize]))
    };
}
export function defaultVoiceModel(category) {
    const entry = CATEGORY_DEFAULTS.find((candidate) => candidate.category === category);
    if (!entry) {
        throw new Error(`no default model for category ${category}`);
    }
    return entry.asset.src;
}
export function defaultTtsFor(profile) {
    const name = defaultTtsModelName(profile);
    const entry = CATEGORY_DEFAULTS.find((candidate) => candidate.name === name);
    if (!entry) {
        throw new Error(`no default tts model named ${name}`);
    }
    return entry;
}
export function infraModelsFor(profile) {
    return CATEGORY_DEFAULTS.filter((entry) => entry.name === mediaModelNameFor(entry.category, profile)).map((entry) => ({ name: entry.name, addon: entry.asset.addon }));
}
export function mediaModelNameFor(category, profile) {
    if (category === 'tts') {
        return defaultTtsFor(profile).name;
    }
    const entry = CATEGORY_DEFAULTS.find((candidate) => candidate.category === category);
    if (!entry) {
        throw new Error(`no default model for category ${category}`);
    }
    return entry.name;
}
const IMAGE_GENERATION_SKILL = 'image-generation';
export const DIFFUSION_CATALOG = [
    {
        choice: 'sd2',
        name: 'StableDiffusion-2.1-Q8_0',
        model: SD_V2_1_1B_Q8_0,
        requiresGpu: false,
        supportsImg2Img: true
    },
    {
        choice: 'sdxl',
        name: 'SDXL-Base-1.0-Q4_0',
        model: SDXL_BASE_1_0_3B_Q4_0,
        requiresGpu: true,
        supportsImg2Img: true
    },
    {
        choice: 'flux2-klein',
        name: 'FLUX.2-Klein-4B-Q4_0',
        model: FLUX_2_KLEIN_4B_Q4_0,
        llmModel: QWEN3_4B_Q4_K_M,
        vaeModel: FLUX_2_KLEIN_4B_VAE,
        prediction: 'flux2_flow',
        requiresGpu: true,
        supportsImg2Img: true
    }
];
function diffusionAssets(entry) {
    const assets = [entry.model];
    if (entry.llmModel) {
        assets.push(entry.llmModel);
    }
    if (entry.vaeModel) {
        assets.push(entry.vaeModel);
    }
    return assets;
}
function diffusionCatalogEntry(model) {
    return DIFFUSION_CATALOG.find((candidate) => candidate.choice === model ||
        candidate.name === model ||
        candidate.model.name === model ||
        candidate.model.src === model);
}
export function diffusionDownloadName(model) {
    return diffusionCatalogEntry(model)?.name ?? null;
}
export function diffusionDownloadMetadata(model, addon) {
    if (addon !== 'diffusion')
        return undefined;
    const entry = diffusionCatalogEntry(model);
    if (!entry) {
        return undefined;
    }
    const assets = diffusionAssets(entry);
    const assetSizes = {};
    for (const asset of assets) {
        assetSizes[asset.src] = asset.expectedSize;
    }
    return {
        companions: assets.slice(1).map((asset) => asset.src),
        assetSizes
    };
}
export function assetBytes(src) {
    const assets = [
        ...curatedListables().map((entry) => entry.asset),
        ...LLM_CATALOG.flatMap((entry) => (entry.projection ? [entry.projection] : [])),
        ...DIFFUSION_CATALOG.flatMap(diffusionAssets),
        ...AUDIOGEN_CATALOG.flatMap((entry) => [entry.dit, entry.textEnc, entry.lm, entry.vae])
    ];
    const custom = customModels().find((entry) => entry.src === src);
    return assets.find((asset) => asset.src === src)?.expectedSize ?? custom?.expectedSize;
}
import { DEFAULT_MUSIC_MODEL_CHOICE, isMusicModelChoice, musicModelChoiceFrom } from './music-catalog.js';
export { DEFAULT_MUSIC_MODEL_CHOICE, isMusicModelChoice, musicModelChoiceFrom };
const MUSIC_GENERATION_SKILL = 'music-generation';
export const AUDIOGEN_CATALOG = [
    {
        choice: 'turbo',
        name: 'ACE-Step-1.5-Turbo-Q4_K_M',
        dit: AUDIOGEN_ACESTEP_V15_TURBO_Q4_K_M,
        textEnc: AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
        lm: AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
        vae: AUDIOGEN_VAE_BF16,
        requiresGpu: false,
        defaultSteps: 8
    },
    {
        choice: 'turbo-hq',
        name: 'ACE-Step-1.5-Turbo-Q8_0',
        dit: AUDIOGEN_ACESTEP_V15_TURBO_Q8_0,
        textEnc: AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
        lm: AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
        vae: AUDIOGEN_VAE_BF16,
        requiresGpu: true,
        defaultSteps: 8
    },
    {
        choice: 'sft',
        name: 'ACE-Step-1.5-SFT-Q8_0',
        dit: AUDIOGEN_ACESTEP_V15_SFT_Q8_0,
        textEnc: AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
        lm: AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
        vae: AUDIOGEN_VAE_BF16,
        requiresGpu: true,
        defaultSteps: 24
    },
    {
        choice: 'base',
        name: 'ACE-Step-1.5-Base-Q4_K_M',
        dit: AUDIOGEN_ACESTEP_V15_BASE_Q4_K_M,
        textEnc: AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0,
        lm: AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0,
        vae: AUDIOGEN_VAE_BF16,
        requiresGpu: true,
        defaultSteps: 50
    }
];
export function musicDefaultSteps(choice) {
    return AUDIOGEN_CATALOG.find((entry) => entry.choice === choice)?.defaultSteps;
}
export function musicChoiceForDit(dit) {
    return AUDIOGEN_CATALOG.find((entry) => entry.dit.src === dit || entry.dit.name === dit)?.choice;
}
function audioGenStages(entry) {
    return [entry.dit, entry.textEnc, entry.lm, entry.vae];
}
export function musicSizeBytes(entry) {
    return audioGenStages(entry).reduce((sum, asset) => sum + asset.expectedSize, 0);
}
export function musicModelSet(choice) {
    const entry = AUDIOGEN_CATALOG.find((candidate) => candidate.choice === choice);
    if (!entry) {
        return null;
    }
    return {
        dit: entry.dit.src,
        textEnc: entry.textEnc.src,
        lm: entry.lm.src,
        vae: entry.vae.src
    };
}
export function audioGenDownloadMetadata(model, addon) {
    if (addon !== 'audiogen')
        return undefined;
    const entry = AUDIOGEN_CATALOG.find((candidate) => candidate.name === model || candidate.dit.name === model || candidate.dit.src === model);
    if (!entry) {
        return undefined;
    }
    const stages = audioGenStages(entry);
    const assetSizes = {};
    for (const asset of stages) {
        assetSizes[asset.src] = asset.expectedSize;
    }
    return {
        companions: stages.slice(1).map((asset) => asset.src),
        assetSizes
    };
}
function agentHasSkill(agent, skill) {
    const installed = agent.installedSkills?.includes(skill) === true;
    return installed && (agent.skillsScope === 'all' || agent.enabledSkills?.includes(skill) === true);
}
export function skillModelsForAgent(agent) {
    const models = [];
    if (agentHasSkill(agent, IMAGE_GENERATION_SKILL)) {
        const choice = agent.imageModelChoice ?? DEFAULT_IMAGE_MODEL_CHOICE;
        const entry = DIFFUSION_CATALOG.find((candidate) => candidate.choice === choice);
        if (entry) {
            models.push({ name: entry.name, addon: entry.model.addon, use: 'image' });
        }
    }
    if (agentHasSkill(agent, MUSIC_GENERATION_SKILL)) {
        const choice = agent.musicModelChoice ?? DEFAULT_MUSIC_MODEL_CHOICE;
        const entry = AUDIOGEN_CATALOG.find((candidate) => candidate.choice === choice);
        if (entry) {
            models.push({ name: entry.name, addon: entry.dit.addon, use: 'music' });
        }
    }
    return models;
}
export function modelsForAgent(agent, host) {
    const skills = skillModelsForAgent(agent);
    if (!agent.modelName) {
        return skills;
    }
    const name = runnableModelName(agent.modelName, host);
    return [{ name, addon: 'llm', use: 'chat' }, ...skills];
}
export function diffusionSizeBytes(entry) {
    return diffusionAssets(entry).reduce((sum, asset) => sum + asset.expectedSize, 0);
}
export function imageModelFor(choice) {
    const entry = DIFFUSION_CATALOG.find((candidate) => candidate.choice === choice);
    if (!entry) {
        return null;
    }
    return {
        model: entry.model.src,
        llmModel: entry.llmModel?.src,
        vaeModel: entry.vaeModel?.src,
        prediction: entry.prediction
    };
}
export function imageClampsFromEnv(env) {
    const positive = (value) => {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const maxDim = positive(env.QVAC_IMAGE_MAX_DIM);
    const maxSteps = positive(env.QVAC_IMAGE_MAX_STEPS);
    if (!maxDim && !maxSteps) {
        return undefined;
    }
    return { maxDim, maxSteps };
}
export function imageModelFromEnv(env, onIgnoredCompanions, onIgnoredPrediction) {
    const catalog = imageModelFor(env.QVAC_IMAGE_MODEL);
    if (catalog) {
        if (env.QVAC_IMAGE_LLM || env.QVAC_IMAGE_VAE || env.QVAC_IMAGE_PREDICTION) {
            onIgnoredCompanions?.();
        }
        return catalog;
    }
    if (!env.QVAC_IMAGE_MODEL) {
        return undefined;
    }
    const prediction = env.QVAC_IMAGE_PREDICTION || undefined;
    const fluxSet = Boolean(env.QVAC_IMAGE_LLM && env.QVAC_IMAGE_VAE);
    if (prediction && !fluxSet) {
        onIgnoredPrediction?.();
    }
    return {
        model: env.QVAC_IMAGE_MODEL,
        llmModel: env.QVAC_IMAGE_LLM || undefined,
        vaeModel: env.QVAC_IMAGE_VAE || undefined,
        prediction: fluxSet ? prediction : undefined
    };
}
export function curatedListables() {
    return [
        ...LLM_CATALOG.map((entry) => ({
            name: entry.name,
            asset: entry.weight,
            companions: [],
            projection: entry.projection
        })),
        ...CATEGORY_DEFAULTS.map((entry) => ({
            name: entry.name,
            asset: entry.asset,
            companions: [...(entry.companions ?? [])]
        })),
        ...DIFFUSION_CATALOG.map((entry) => ({
            name: entry.name,
            asset: entry.model,
            companions: [entry.llmModel, entry.vaeModel].filter((asset) => asset !== undefined)
        }))
    ];
}
export function curatedModelAsset(name, addon) {
    return curatedListables().find((entry) => entry.asset.addon === addon && (entry.name === name || entry.asset.name === name))?.asset;
}
export function modelAddonOf(model) {
    const known = [...curatedListables(), ...musicListables()].find((entry) => entry.name === model || entry.asset.name === model || entry.asset.src === model);
    return known?.asset.addon ?? 'llm';
}
export function residentSrc(model, addon) {
    return curatedModelAsset(model, addon)?.src ?? model;
}
export function catalogModelName(model, addon) {
    const known = curatedListables().find((entry) => entry.asset.addon === addon &&
        (entry.name === model || entry.asset.name === model || entry.asset.src === model));
    return known?.name ?? model;
}
export const CUSTOM_TASK_TYPES = ['llm'];
let CUSTOM_MODELS = new Map();
export function setCustomModels(entries) {
    CUSTOM_MODELS = new Map(entries.map((entry) => [entry.name, entry]));
}
export function customModels() {
    return [...CUSTOM_MODELS.values()];
}
export function customContextLength(name) {
    return CUSTOM_MODELS.get(name)?.contextLength;
}
export function customModelSrc(name, addon) {
    const entry = CUSTOM_MODELS.get(name);
    return entry && (entry.taskType ?? 'llm') === addon ? entry.src : undefined;
}
export function toolDialectFor(name) {
    return LLM_CATALOG.find((entry) => entry.name === name)?.toolDialect ?? customToolDialect(name);
}
export function customToolDialect(name) {
    const entry = CUSTOM_MODELS.get(name);
    return entry
        ? detectToolDialect(entry.src, entry.label?.replace(/\s+/g, '-') ?? entry.name)
        : undefined;
}
export function customProjectionMap() {
    const map = {};
    for (const entry of CUSTOM_MODELS.values()) {
        if (entry.projectionSrc) {
            map[entry.name] = entry.projectionSrc;
        }
    }
    return map;
}
export function companionRegistryPaths() {
    const map = new Map();
    for (const entry of LLM_CATALOG) {
        if (entry.projection) {
            map.set(entry.weight.registryPath, [entry.projection.registryPath]);
        }
    }
    for (const entry of DIFFUSION_CATALOG) {
        const companions = [entry.llmModel, entry.vaeModel].flatMap((asset) => asset ? [asset.registryPath] : []);
        if (companions.length) {
            map.set(entry.model.registryPath, companions);
        }
    }
    for (const entry of CATEGORY_DEFAULTS) {
        if (entry.companions) {
            map.set(entry.asset.registryPath, entry.companions.map((asset) => asset.registryPath));
        }
    }
    for (const entry of AUDIOGEN_CATALOG) {
        map.set(entry.dit.registryPath, [
            entry.textEnc.registryPath,
            entry.lm.registryPath,
            entry.vae.registryPath
        ]);
    }
    return map;
}
export function audioGenModelByName(name) {
    for (const entry of AUDIOGEN_CATALOG) {
        for (const stage of [entry.dit, entry.textEnc, entry.lm, entry.vae]) {
            if (stage.name === name || entry.name === name) {
                return name === entry.name ? entry.dit : stage;
            }
        }
    }
    return undefined;
}
export function musicListables() {
    return AUDIOGEN_CATALOG.map((entry) => ({
        name: entry.name,
        asset: entry.dit,
        companions: [entry.textEnc, entry.lm, entry.vae],
        expectedSize: musicSizeBytes(entry)
    }));
}
