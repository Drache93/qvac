import { resolveAudioGenPcm } from './audio-gen-input.js';
import { streamAudioGenRun } from './audio-gen-run.js';
/**
 * ACE-Step's reverse pipeline: encode a recording, recover its FSQ semantic
 * codes, and let the LM describe it. Shares the generation path's admission and
 * cancellation, and streams the description as one `understand` frame before
 * the terminal frame repeats it on `stats`.
 */
export function audioUnderstand(request) {
    return streamAudioGenRun({
        type: 'audioUnderstand',
        request,
        async start(model, ctx) {
            // Decoded before the job is admitted, so the model slot is never held by
            // a request that fails on input decoding.
            const sourceAudio = await resolveAudioGenPcm(request.sourceAudio, 'sourceAudio');
            if (ctx.signal.aborted)
                return undefined;
            return model.understand(sourceAudio, {
                ...(request.seed !== undefined && { seed: request.seed }),
                ...(request.vocalLanguage !== undefined && { vocalLanguage: request.vocalLanguage }),
                ...(request.lmTemperature !== undefined && { lmTemperature: request.lmTemperature }),
                ...(request.lmTopP !== undefined && { lmTopP: request.lmTopP }),
                ...(request.lmTopK !== undefined && { lmTopK: request.lmTopK })
            });
        }
    });
}
