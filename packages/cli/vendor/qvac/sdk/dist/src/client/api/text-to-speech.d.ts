import { type TtsClientParamsInput, type RPCOptions, type TtsResponse, type TextToSpeechStreamClientParams, type TextToSpeechStreamSession, type TextToSpeechStreamResult, type TtsStats } from '@qvac/inference/surface';
/**
 * Fan-out queue that lets multiple consumers iterate the same TTS response
 * stream independently. Items are retained only until every active subscriber
 * has consumed them, then trimmed from the queue.
 *
 * The source is injected as an `AsyncIterable<TtsResponse>` so this class can
 * be unit-tested directly against the real implementation (without mocking
 * the RPC layer). Production callsites adapt `streamRpc(...)` via
 * `ttsResponseSource()` below.
 *
 * Exported for test use; not part of the public SDK surface.
 */
export declare class TtsMulticast {
    private readonly queue;
    private readonly waiters;
    private readonly subscriberIndexes;
    private ended;
    private fatal;
    private readonly resolvePumpDone;
    private readonly rejectPumpDone;
    readonly done: Promise<boolean>;
    constructor(source: AsyncIterable<TtsResponse>);
    subscribe(): AsyncGenerator<TtsResponse>;
    private notify;
    private trimConsumed;
    private unsubscribe;
    private pump;
    private drain;
}
/**
 * Converts text to speech audio using a loaded TTS model.
 *
 * Three modes selected by `params.stream` and `params.sentenceStream`:
 *
 * - `stream: false` — collect all PCM samples and resolve once via
 *   `result.buffer` (`Promise<number[]>`). `bufferStream` is empty.
 * - `stream: true` (default) — yield PCM samples through `result.bufferStream`
 *   (`AsyncGenerator<number>`) as they arrive. `buffer` resolves to an empty
 *   array.
 * - `stream: true, sentenceStream: true` — also exposes `result.chunkUpdates`
 *   (`AsyncGenerator<TtsSentenceChunkUpdate>`) so callers can mux per-sentence
 *   metadata with the audio. Multiple consumers can iterate the response
 *   independently via the underlying `TtsMulticast`.
 *
 * MOSS models stream natively rather than by sentence: under `stream: true`
 * the whole text is one synthesis whose audio arrives every
 * `streamChunkTokens` codec frames (in one piece when that is unset), so
 * `durationTokens` and a MOSS-TTSD dialogue's reference transcripts apply to
 * the text as a whole. `sentenceStream: true` still splits a single-speaker
 * text; a dialogue rejects it. `sentenceStreamLocale` and
 * `sentenceStreamMaxChunkScalars` configure that splitting, so a MOSS request
 * rejects them unless it sets `sentenceStream: true`.
 *
 * `result.done` resolves to `true` when synthesis completes cleanly, `false`
 * if the consumer breaks out before the terminal frame, or rejects on a
 * pipeline error. Awaiting `done` is safe even when no stream is iterated.
 *
 * `result.sampleRate` resolves from the first audio frame (so it can be awaited
 * before draining the audio); `result.stats` and `result.stopReason` resolve
 * from the terminal frame. All three resolve — with `undefined` when the run
 * produced none — rather than reject. In `stream: true` mode (the default) the
 * run starts lazily: nothing is sent until `bufferStream` is first iterated, so
 * `done`, `sampleRate`, `stats` and `stopReason` stay pending until then. In
 * `stream: false` and `sentenceStream: true` modes the run starts immediately.
 * Read `sampleRate` rather than assuming the engine default: `outputSampleRate`
 * and the LavaSR enhancer both change it.
 *
 * @param params - TTS request parameters (see `TtsClientParamsInput`).
 * @param options - Optional RPC options (timeout, profiling, force new connection).
 * @returns A `TextToSpeechStreamResult` with `bufferStream`, `buffer`, `done`,
 *          `sampleRate`, `stats`, and (when `sentenceStream: true`)
 *          `chunkUpdates`.
 * @throws {TextToSpeechStreamFailedError} When `sentenceStream: true` is paired
 *         with `stream: false`, or when the underlying RPC stream errors.
 */
export declare function textToSpeech(params: TtsClientParamsInput, options?: RPCOptions): TextToSpeechStreamResult;
/**
 * The output rate and the runtime stats ride the response frames, but the
 * three result shapes below expose PCM through generators a caller may abandon
 * early. This collects both off the frames as they pass and hands them back as
 * promises that always RESOLVE — with `undefined` when the run produced none —
 * so `await result.sampleRate` can never hang or reject on its own.
 */
export type TtsSideChannel = {
    text: Promise<string | undefined>;
    sampleRate: Promise<number | undefined>;
    stats: Promise<TtsStats | undefined>;
    stopReason: Promise<'completed' | 'cancelled' | undefined>;
    observe(response: TtsResponse): void;
    settle(): void;
};
/** Exported for test use; not part of the public SDK surface. */
export declare function createTtsSideChannel(): TtsSideChannel;
export declare function encodeTextToSpeechFragment(textFragment: string | Uint8Array): Uint8Array<ArrayBufferLike>;
/**
 * Duplex session: write UTF-8 text fragments (e.g. LLM token deltas) via `write`. Each string or
 * Uint8Array should be a complete UTF-8 fragment. The worker forwards them to the TTS streaming handler
 * (optional sentence accumulation via request fields). Iterate the session for `TextToSpeechStreamResponse`
 * lines (PCM in `buffer`, optional `chunkIndex` / `sentenceChunk`) until `done`.
 *
 * @param params - The loaded TTS model, input mode, buffering controls, and
 *   optional voice settings.
 * @param options - Optional timeout, profiling, and connection settings.
 * @returns A single-consumer duplex session for writing text fragments and
 *   iterating PCM response frames.
 * @throws {TextToSpeechStreamFailedError} When the session is iterated more
 *   than once, receives a server error, or is written after closing.
 */
export declare function textToSpeechStream(params: TextToSpeechStreamClientParams, options?: RPCOptions): Promise<TextToSpeechStreamSession>;
//# sourceMappingURL=text-to-speech.d.ts.map