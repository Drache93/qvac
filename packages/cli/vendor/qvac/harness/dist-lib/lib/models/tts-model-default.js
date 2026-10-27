const TTS_MODEL_BY_PROFILE = {
    tiny: 'Supertonic3-Q4_0',
    low: 'Supertonic3-Q4_0',
    mid: 'Supertonic3-FP16',
    high: 'Supertonic3-FP16',
    xhigh: 'Supertonic3-FP16'
};
export const TTS_MODEL_NAMES = [
    ...new Set(Object.values(TTS_MODEL_BY_PROFILE))
];
export function defaultTtsModelName(profile) {
    return TTS_MODEL_BY_PROFILE[profile];
}
