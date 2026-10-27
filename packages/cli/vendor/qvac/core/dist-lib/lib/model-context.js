import { QWEN_35_2B, QWEN_35_4B, QWEN_35_9B, QWEN_36_27B, QWEN_36_35B_A3B, QWEN_38_27B, MEDPSY_1_7B, MEDPSY_4B } from './llm-model-names.js';
const QWEN_35_MAX_CONTEXT = 262_144;
const QWEN_36_MAX_CONTEXT = 262_144;
const QWEN_38_MAX_CONTEXT = 262_144;
const MEDPSY_1_7B_MAX_CONTEXT = 32_768;
const MEDPSY_4B_MAX_CONTEXT = 262_144;
const DESKTOP_DEFAULT_CONTEXT_SIZE = 51_200;
const MOBILE_SMALL_CONTEXT_SIZE = 12_288;
const HARNESS_FILE_SOURCE_CONTEXT_SIZE = DESKTOP_DEFAULT_CONTEXT_SIZE;
export const MOBILE_CONTEXT_SIZE = MOBILE_SMALL_CONTEXT_SIZE;
export const MODEL_CONTEXT_TARGET = {
    desktop: 'desktop',
    mobile: 'mobile'
};
export function modelContextTargetForPlatform(platform) {
    if (!platform) {
        return null;
    }
    if (platform === 'ios' || platform === 'android') {
        return MODEL_CONTEXT_TARGET.mobile;
    }
    return MODEL_CONTEXT_TARGET.desktop;
}
const MODEL_CONTEXT_SPECS = [
    { name: QWEN_35_2B, maxContextTokens: QWEN_35_MAX_CONTEXT, parameterBillions: 2 },
    { name: QWEN_35_4B, maxContextTokens: QWEN_35_MAX_CONTEXT, parameterBillions: 4 },
    { name: QWEN_35_9B, maxContextTokens: QWEN_35_MAX_CONTEXT, parameterBillions: 9 },
    { name: QWEN_36_27B, maxContextTokens: QWEN_36_MAX_CONTEXT, parameterBillions: 27 },
    { name: QWEN_36_35B_A3B, maxContextTokens: QWEN_36_MAX_CONTEXT, parameterBillions: 35 },
    { name: QWEN_38_27B, maxContextTokens: QWEN_38_MAX_CONTEXT, parameterBillions: 27 },
    { name: MEDPSY_1_7B, maxContextTokens: MEDPSY_1_7B_MAX_CONTEXT, parameterBillions: 1.7 },
    { name: MEDPSY_4B, maxContextTokens: MEDPSY_4B_MAX_CONTEXT, parameterBillions: 4 }
];
const CONTEXT_BY_MODEL = new Map(MODEL_CONTEXT_SPECS.map((spec) => [spec.name, spec.maxContextTokens]));
const SPEC_BY_MODEL = new Map(MODEL_CONTEXT_SPECS.map((spec) => [spec.name, spec]));
const STANDARD_CONTEXT_OPTIONS = [
    1_024, 2_048, 4_096, 8_192, 16_384, 32_768, 65_536, 131_072, 262_144
];
export const DEFAULT_CONTEXT_SIZE = 8_192;
export const COMPACTION_MIN_CTX_SIZE = 4_096;
export function maxContextForModel(modelName, opts = {}) {
    const { custom } = opts;
    if (custom) {
        return custom.contextLength || HARNESS_FILE_SOURCE_CONTEXT_SIZE;
    }
    return CONTEXT_BY_MODEL.get(modelName) ?? DEFAULT_CONTEXT_SIZE;
}
export function defaultContextForModel(modelName, target = MODEL_CONTEXT_TARGET.desktop, opts = {}) {
    if (opts.custom) {
        return Math.min(HARNESS_FILE_SOURCE_CONTEXT_SIZE, opts.custom.contextLength || HARNESS_FILE_SOURCE_CONTEXT_SIZE);
    }
    const spec = SPEC_BY_MODEL.get(modelName);
    if (!spec) {
        return DEFAULT_CONTEXT_SIZE;
    }
    if (target === MODEL_CONTEXT_TARGET.mobile && spec.parameterBillions <= 4) {
        return Math.min(MOBILE_SMALL_CONTEXT_SIZE, spec.maxContextTokens);
    }
    return Math.min(DESKTOP_DEFAULT_CONTEXT_SIZE, spec.maxContextTokens);
}
export function formatTokenCount(n) {
    if (n >= 1_000_000) {
        return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M ctx`;
    }
    if (n >= 1_000) {
        return `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K ctx`;
    }
    return `${n.toLocaleString()} ctx`;
}
export function contextOptionsForModel(modelName, target = MODEL_CONTEXT_TARGET.desktop, opts = {}) {
    const defaultContext = defaultContextForModel(modelName, target, opts);
    const ceiling = maxContextForModel(modelName, opts);
    const options = [
        ...STANDARD_CONTEXT_OPTIONS.filter((size) => size <= ceiling),
        defaultContext,
        ceiling
    ];
    return [...new Set(options)].sort((a, b) => a - b);
}
