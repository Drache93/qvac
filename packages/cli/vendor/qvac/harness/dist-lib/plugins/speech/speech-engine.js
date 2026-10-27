import { categoryModelConfig, defaultTtsFor, defaultVoiceModel, MOSS_CODEC_ENCODER_SRC, MOSS_TTS } from '../../lib/models/model-catalog.js';
const SUPERTONIC_CONFIG = {
    ttsEngine: 'supertonic',
    language: 'en',
    ttsSpeed: 1.175,
    ttsNumInferenceSteps: 5
};
const MAX_SPEAKERS = 5;
export function invalidOptions({ tts, voice, dialogue }) {
    if (voice && dialogue) {
        return 'a cloned voice and a dialogue are exclusive: give each speaker a recording instead';
    }
    if ((voice || dialogue) && tts !== 'moss') {
        return "a cloned voice or a dialogue needs tts: 'moss'";
    }
    if (dialogue && (dialogue.speakers.length < 1 || dialogue.speakers.length > MAX_SPEAKERS)) {
        return `a dialogue takes 1 to ${MAX_SPEAKERS} speakers`;
    }
    return null;
}
export function defaultTts({ tts, dialogue }, profile) {
    if (tts === 'moss') {
        return dialogue ? dialogue.backbone : MOSS_TTS.asset.src;
    }
    return profile ? defaultTtsFor(profile).asset.src : defaultVoiceModel('tts');
}
export function isDialogue({ dialogue }, src) {
    return dialogue !== undefined && src === dialogue.backbone;
}
export function engineOf(options, src) {
    return isDialogue(options, src) || categoryModelConfig(src)?.['ttsEngine'] === 'moss'
        ? 'moss'
        : 'supertonic';
}
export function dialogueScript({ dialogue }, text) {
    const references = (dialogue?.speakers ?? []).map((speaker, index) => `[S${index + 1}] ${speaker.transcript}`);
    return [...references, text].join(' ');
}
export function loadConfig({ voice, dialogue }, modelSrc) {
    const src = typeof modelSrc === 'string' ? modelSrc : modelSrc.src;
    if (dialogue && src === dialogue.backbone) {
        return {
            ...MOSS_TTS.modelConfig,
            mossCodecEncoderModelSrc: MOSS_CODEC_ENCODER_SRC,
            dialogueReferenceSrcs: dialogue.speakers.map((speaker) => speaker.audio)
        };
    }
    const tuned = categoryModelConfig(modelSrc);
    if (tuned?.['ttsEngine'] !== 'moss') {
        return { ...SUPERTONIC_CONFIG, ...tuned };
    }
    return voice
        ? { ...tuned, mossCodecEncoderModelSrc: MOSS_CODEC_ENCODER_SRC, referenceAudioSrc: voice }
        : tuned;
}
