export const CAPABILITY_PROFILE_ORDER = [
    'tiny',
    'low',
    'mid',
    'high',
    'xhigh'
];
export const QWEN_35_2B = 'Qwen3.5-2B-Q4_K_M';
export const QWEN_35_4B = 'Qwen3.5-4B-Q4_K_M';
export const QWEN_35_9B = 'Qwen3.5-9B-Q4_K_M';
export const QWEN_36_27B = 'Qwen3.6-27B-UD-Q4_K_XL';
export const QWEN_36_35B_A3B = 'Qwen3.6-35B-A3B-UD-Q4_K_M';
export const QWEN_38_27B = 'Qwen3.8-27B-UD-Q4_K_XL';
export const BONSAI_2_27B_PQ2 = 'Ternary-Bonsai-2-27B-PQ2_0';
export const BONSAI_2_27B_PTQ1 = 'Ternary-Bonsai-2-27B-PTQ1_0';
export const MEDPSY_1_7B = 'medpsy-1.7b-q4_k_m-imat';
export const MEDPSY_4B = 'medpsy-4b-q4_k_m-imat';
export function isCapabilityProfile(value) {
    return CAPABILITY_PROFILE_ORDER.some((profile) => profile === value);
}
export function meetsMinCapabilityProfile(active, required) {
    return CAPABILITY_PROFILE_ORDER.indexOf(active) >= CAPABILITY_PROFILE_ORDER.indexOf(required);
}
const MODEL_NAME_TO_PROFILE = new Map([
    [QWEN_35_2B, 'low'],
    [QWEN_35_4B, 'mid'],
    [QWEN_35_9B, 'high'],
    [QWEN_36_27B, 'xhigh'],
    [QWEN_36_35B_A3B, 'xhigh'],
    [QWEN_38_27B, 'xhigh'],
    [BONSAI_2_27B_PQ2, 'high'],
    [BONSAI_2_27B_PTQ1, 'high'],
    [MEDPSY_1_7B, 'low'],
    [MEDPSY_4B, 'mid']
]);
export function modelNameToCapabilityProfile(modelName) {
    return MODEL_NAME_TO_PROFILE.get(modelName);
}
export function isMobilePlatform(platform) {
    return platform === 'android' || platform === 'ios';
}
export function runnableModelName(requested, host) {
    if (!host?.mobile || !isCapabilityProfile(host.capabilityProfile)) {
        return requested;
    }
    const required = modelNameToCapabilityProfile(requested);
    if (!required || meetsMinCapabilityProfile(host.capabilityProfile, required)) {
        return requested;
    }
    const fallback = modelNameToCapabilityProfile(host.recommendedModelName);
    if (!fallback || !meetsMinCapabilityProfile(required, fallback)) {
        return requested;
    }
    return host.recommendedModelName;
}
const PROFILE_TO_MODEL_NAME = new Map([
    ['tiny', QWEN_35_2B],
    ['low', QWEN_35_2B],
    ['mid', QWEN_35_4B],
    ['high', QWEN_35_9B],
    ['xhigh', QWEN_38_27B]
]);
export function capabilityProfileToModelName(profile) {
    const name = PROFILE_TO_MODEL_NAME.get(profile);
    if (!name) {
        throw new Error(`no model for capability profile ${profile}`);
    }
    return name;
}
export const AGENT_MODEL_NAMES = [
    QWEN_35_2B,
    QWEN_35_4B,
    QWEN_35_9B,
    QWEN_36_27B,
    QWEN_36_35B_A3B,
    QWEN_38_27B,
    BONSAI_2_27B_PQ2,
    BONSAI_2_27B_PTQ1,
    MEDPSY_1_7B,
    MEDPSY_4B
];
export function modelDisplayName(modelName) {
    const quant = /-(?:UD-)?I?Q\d/i.exec(modelName);
    const base = quant ? modelName.slice(0, quant.index) : modelName;
    return base.replace(/-/g, ' ');
}
export function capabilityProfileModelLabel(profile) {
    return modelDisplayName(capabilityProfileToModelName(profile));
}
const MULTIMODAL_LLMS = new Set([
    QWEN_35_2B,
    QWEN_35_4B,
    QWEN_35_9B,
    QWEN_36_27B,
    QWEN_36_35B_A3B,
    QWEN_38_27B,
    BONSAI_2_27B_PQ2,
    BONSAI_2_27B_PTQ1
]);
export function isMultimodalLlm(modelName) {
    return MULTIMODAL_LLMS.has(modelName);
}
export const DEFAULT_IMAGE_MODEL_CHOICE = 'sd2';
export const IMAGE_CHOICE_CATALOG = [
    {
        choice: 'sd2',
        label: 'Stable Diffusion 2.1 (1B Q8)',
        requiresGpu: false,
        supportsMultiImageEdit: false,
        sizeBytesApprox: 2_300_000_000,
        notes: 'Fast, 512x512 sweet spot, SDEdit img2img.'
    },
    {
        choice: 'sdxl',
        label: 'SDXL Base 1.0 (3B Q4)',
        requiresGpu: true,
        supportsMultiImageEdit: false,
        sizeBytesApprox: 3_900_000_000,
        notes: 'Higher quality, 1024x1024 native.'
    },
    {
        choice: 'flux2-klein',
        label: 'FLUX.2 Klein (4B Q4 + Qwen3 + VAE)',
        requiresGpu: true,
        supportsMultiImageEdit: true,
        sizeBytesApprox: 5_100_000_000,
        notes: 'In-context img2img + multi-ref fusion. Set prediction=flux2_flow for editing.'
    }
];
