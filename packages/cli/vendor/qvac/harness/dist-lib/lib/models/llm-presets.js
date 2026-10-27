export const DEFAULT_REASONING_BUDGET = 8192;
const QWEN_NONTHINKING_VL_SAMPLER = {
    temp: 0.7,
    top_p: 0.8,
    top_k: 20,
    presence_penalty: 1.5,
    repeat_penalty: 1.0,
    frequency_penalty: 0
};
const QWEN_THINKING_VL_OR_CODING_SAMPLER = {
    temp: 0.6,
    top_p: 0.95,
    top_k: 20,
    presence_penalty: 0,
    repeat_penalty: 1.0,
    frequency_penalty: 0
};
const QWEN_THINKING_GENERAL_SAMPLER = {
    temp: 1.0,
    top_p: 0.95,
    top_k: 20,
    presence_penalty: 1.5,
    repeat_penalty: 1.0,
    frequency_penalty: 0
};
const PRESET_RESOLVERS = [
    { prefix: 'Qwen3.5-0.8B-', resolve: qwen08BPreset },
    { prefix: 'Qwen3.5-2B-', resolve: qwen2BPreset },
    { prefix: 'Qwen3.5-4B-', resolve: qwen4BPreset }
];
export function resolveLlmGenerationParams(modelName, reasoningEnabled, deviceDefault) {
    const effective = reasoningEnabled ?? deviceDefault;
    const resolver = modelName
        ? PRESET_RESOLVERS.find((entry) => modelName.startsWith(entry.prefix))
        : undefined;
    if (resolver) {
        return resolver.resolve(effective);
    }
    if (effective === undefined) {
        return undefined;
    }
    return { reasoning_budget: effective ? DEFAULT_REASONING_BUDGET : 0 };
}
function qwen08BPreset(reasoningEnabled) {
    return reasoningEnabled === true ? thinkingVlPreset() : nonThinkingVlPreset();
}
function qwen2BPreset(reasoningEnabled) {
    return reasoningEnabled === false ? nonThinkingVlPreset() : thinkingVlPreset();
}
function qwen4BPreset(reasoningEnabled) {
    return reasoningEnabled === false ? nonThinkingVlPreset() : thinkingGeneralPreset();
}
function nonThinkingVlPreset() {
    return { ...QWEN_NONTHINKING_VL_SAMPLER, reasoning_budget: 0 };
}
function thinkingVlPreset() {
    return { ...QWEN_THINKING_VL_OR_CODING_SAMPLER, reasoning_budget: DEFAULT_REASONING_BUDGET };
}
function thinkingGeneralPreset() {
    return { ...QWEN_THINKING_GENERAL_SAMPLER, reasoning_budget: DEFAULT_REASONING_BUDGET };
}
