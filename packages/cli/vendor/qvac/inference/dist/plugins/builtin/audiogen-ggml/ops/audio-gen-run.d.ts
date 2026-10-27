import { AudioGen } from '@qvac/audiogen-ggml';
import { type AudioGenStreamResponse, type AudioUnderstandResponse } from '../../../../schemas/audio-gen.js';
import { type Logger } from '../../../../logging/index.js';
import { type RequestContext } from '../../../../runtime/index.js';
/**
 * Wire types that stream an AudioGen run: generation, source-driven editing,
 * and the reverse pipeline behind `audioUnderstand()`.
 */
export type AudioGenRunType = 'audioGenStream' | 'audioEditStream' | 'audioUnderstand';
/**
 * A stream frame for `TType`. Generation and editing share every field but
 * `type`; understanding carries a description instead of PCM.
 *
 * The frames below are built as object literals inside a generic function, so
 * TypeScript cannot match them to the narrowed conditional type on its own —
 * each `yield` asserts the frame it just built. The shapes are pinned at the
 * boundary regardless: every frame is parsed against this handler's response
 * schema before it reaches a caller.
 */
export type AudioGenRunFrame<TType extends AudioGenRunType> = TType extends 'audioUnderstand' ? AudioUnderstandResponse : Omit<AudioGenStreamResponse, 'type'> & {
    type: TType;
};
export type AudioGenRunResponse = Awaited<ReturnType<AudioGen['run']>>;
export interface AudioGenRunOptions<TType extends AudioGenRunType> {
    type: TType;
    request: {
        modelId: string;
        requestId?: string | undefined;
    };
    /**
     * Prepares the inputs and admits the native job once the request holds the
     * model slot. Preparation (decoding audio) can take real time, so the
     * callback must re-check `ctx.signal` after it and return `undefined`
     * without starting the job when an abort fired mid-way: that abort found no
     * active native job to cancel, and starting the run afterwards would leave
     * a ghost generation on the slot.
     */
    start: (model: AudioGen, ctx: RequestContext, logger: Logger) => Promise<AudioGenRunResponse | undefined>;
}
/**
 * Runs one AudioGen job under the request registry and streams it as
 * `TType` frames: progress ticks, PCM chunks, then the terminal frame with
 * stats and backend diagnostics. Owns admission (`kind: 'audiogen'`, one
 * active job per model), abort-to-cancel wiring, and the cancelled terminal.
 */
export declare function streamAudioGenRun<TType extends AudioGenRunType>(options: AudioGenRunOptions<TType>): AsyncGenerator<AudioGenRunFrame<TType>>;
