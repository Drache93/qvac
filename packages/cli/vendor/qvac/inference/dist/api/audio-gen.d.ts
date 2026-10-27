import { type AudioEditClientParams, type AudioGenClientParams, type AudioGenResult, type AudioUnderstandClientParams, type AudioUnderstandResult } from '../schemas/index.js';
/**
 * Generates audio (music / speech) from a caption using a loaded ACE-Step or
 * MiniMax-Music3 AudioGen model.
 *
 * @param params - AudioGen request parameters (model, caption, optional lyrics, seed, bpm, etc.).
 * @returns A result object exposing `requestId`, `progressStream` (async iterator of `{ stage, step, total }`), `audio` (promise of the generated PCM and its format), `stats` (promise of generation statistics), and `diagnostics` (promise of the backend selection detail for the run).
 *
 * @example
 * ```typescript
 * const { progressStream, audio } = audioGen({ modelId, caption: "lo-fi hip hop, mellow piano" });
 * for await (const { stage, step, total } of progressStream) {
 *   console.log(total > 0 ? `${stage} ${step}/${total}` : `${stage} ${step} (indeterminate)`);
 * }
 * const { pcm, sampleRate, channels, bitsPerSample } = await audio;
 * ```
 */
export declare function audioGen(params: AudioGenClientParams): AudioGenResult;
/**
 * Edits a source recording with a loaded ACE-Step AudioGen model: an ordered
 * pipeline of `flow-edit` (re-condition the whole clip from one prompt to
 * another) and `repaint` (regenerate a time range) operations, executed in
 * array order. The source is interleaved stereo 48 kHz PCM — a file path
 * decoded server-side, or raw Float32 LE bytes in `[-1, 1]`.
 *
 * @param params - Loaded model ID, the source audio, the ordered `operations`, and optional run
 *   controls that apply to every operation: `seed`, a timbre `referenceAudio`, the prompt
 *   metadata (`vocalLanguage`, `bpm`, `keyscale`, `timesignature`, `augmentCaptionWithMetadata`),
 *   the Repaint DCW controls, and per-run `inferenceSteps` and `shift`.
 * @returns The same run shape as `audioGen()`: `requestId`, `progressStream`, `audio`, `stats`, and `diagnostics`.
 *
 * @example
 * ```typescript
 * const run = audioEdit({
 *   modelId,
 *   sourceAudio: "/path/to/song.wav",
 *   operations: [
 *     { type: "flow-edit", from: { caption: "acoustic folk" }, to: { caption: "synthwave" } },
 *     { type: "repaint", caption: "analog synth solo", start: 10, end: 20 },
 *   ],
 *   seed: 7,
 * });
 * const { pcm, sampleRate, channels, bitsPerSample } = await run.audio;
 * ```
 */
export declare function audioEdit(params: AudioEditClientParams): AudioGenResult;
/**
 * Describes a recording with a loaded ACE-Step AudioGen model, running the
 * engine's reverse pipeline: the PCM is encoded, its FSQ semantic codes are
 * recovered, and the LM reports the clip's caption and metadata. The recovered
 * `audioCodes` can be fed straight back into `audioGen()`.
 *
 * @param params - Loaded model ID, the source audio, and optional LM sampling controls.
 * @returns `requestId`, `progressStream`, the `description`, `stats`, and `diagnostics`.
 *
 * @example
 * ```typescript
 * const run = audioUnderstand({ modelId, sourceAudio: "/path/to/song.wav" });
 * const { caption, bpm, keyscale, audioCodes } = await run.description;
 * ```
 */
export declare function audioUnderstand(params: AudioUnderstandClientParams): AudioUnderstandResult;
