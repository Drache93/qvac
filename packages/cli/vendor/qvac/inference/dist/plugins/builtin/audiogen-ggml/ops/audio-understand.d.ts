import type { AudioUnderstandRequest, AudioUnderstandResponse } from '../../../../schemas/audio-gen.js';
/**
 * ACE-Step's reverse pipeline: encode a recording, recover its FSQ semantic
 * codes, and let the LM describe it. Shares the generation path's admission and
 * cancellation, and streams the description as one `understand` frame before
 * the terminal frame repeats it on `stats`.
 */
export declare function audioUnderstand(request: AudioUnderstandRequest): AsyncGenerator<AudioUnderstandResponse>;
