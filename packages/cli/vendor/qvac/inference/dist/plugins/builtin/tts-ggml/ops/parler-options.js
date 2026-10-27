import { TTS_COSYVOICE3_EMOTIONS } from '../../../../schemas/index.js';
import { PluginRequestValidationFailedError } from '../../../../errors/index.js';
function hasEngineType(model) {
    return (typeof model === 'object' &&
        model !== null &&
        'getEngineType' in model &&
        typeof model.getEngineType === 'function');
}
/** The loaded addon's engine (`TTSGgml#getEngineType()`), when it reports one. */
export function getTtsEngineType(model) {
    return hasEngineType(model) ? model.getEngineType() : undefined;
}
export function getParlerJobOptions(request) {
    return {
        ...(request.description !== undefined ? { description: request.description } : {}),
        ...(request.voiceDescription !== undefined
            ? { voiceDescription: request.voiceDescription }
            : {}),
        ...(request.voice !== undefined ? { voice: request.voice } : {}),
        ...(request.emotion !== undefined ? { emotion: request.emotion } : {}),
        ...(request.pitch !== undefined ? { pitch: request.pitch } : {}),
        ...(request.pace !== undefined ? { pace: request.pace } : {}),
        ...(request.expressivity !== undefined ? { expressivity: request.expressivity } : {}),
        ...(request.noise !== undefined ? { noise: request.noise } : {}),
        ...(request.reverb !== undefined ? { reverb: request.reverb } : {}),
        ...(request.quality !== undefined ? { quality: request.quality } : {})
    };
}
// Per-call conditioning keys shared by the engines that support them.
// CosyVoice3 accepts the cross-engine emotion/pace pair; everything else in
// the description/template surface remains Parler-only.
const CROSS_ENGINE_CONDITIONING_KEYS = ['emotion', 'pace'];
export function assertParlerJobOptionsSupported(model, options, handlerName) {
    const setKeys = Object.keys(options);
    if (setKeys.length === 0)
        return;
    const engine = getTtsEngineType(model);
    if (engine === 'parler')
        return;
    if (engine === 'cosyvoice3') {
        const parlerOnlyKeys = setKeys.filter((key) => !CROSS_ENGINE_CONDITIONING_KEYS.includes(key));
        if (parlerOnlyKeys.length > 0) {
            throw new PluginRequestValidationFailedError(handlerName, `${parlerOnlyKeys.join(', ')} ${parlerOnlyKeys.length === 1 ? 'is' : 'are'} only supported by Parler TTS models; CosyVoice3 supports emotion and pace`);
        }
        // The request schema validates `emotion` against Parler's 12-value
        // vocabulary because a request carries only an opaque modelId. Now that
        // the engine is known, narrow it to the four CosyVoice3 has a trained
        // instruction for — the addon rejects the other eight, and rejecting them
        // here names the supported set instead of surfacing a raw addon throw.
        if (options.emotion !== undefined &&
            !TTS_COSYVOICE3_EMOTIONS.includes(options.emotion)) {
            throw new PluginRequestValidationFailedError(handlerName, `emotion "${options.emotion}" is not supported by CosyVoice3; use one of ${TTS_COSYVOICE3_EMOTIONS.join(', ')}`);
        }
        // CosyVoice3 is trained on one instruction per synthesis; a request that
        // engages both channels always conflicts regardless of the loaded config.
        if (options.emotion !== undefined &&
            options.pace !== undefined &&
            options.pace !== 'moderate') {
            throw new PluginRequestValidationFailedError(handlerName, 'CosyVoice3 accepts one conditioning control per synthesis; set either emotion or a non-moderate pace, not both');
        }
        return;
    }
    throw new PluginRequestValidationFailedError(handlerName, 'description, voiceDescription, voice, emotion, pitch, pace, expressivity, noise, reverb, and quality are only supported by Parler TTS and CosyVoice3 models (CosyVoice3: emotion and pace only)');
}
