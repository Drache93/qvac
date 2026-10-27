import { audioEditClientParamsSchema, audioEditStreamResponseSchema, audioGenClientParamsSchema, audioGenStreamResponseSchema, audioUnderstandClientParamsSchema, audioUnderstandResponseSchema } from '../schemas/index.js';
import { stream } from '../dispatch.js';
import { parseClientInput } from './parse-input.js';
import { generateRandomRequestId } from '../runtime/request-id.js';
import { decodeBase64 } from '../utils/encoding.js';
import { InvalidResponseError, InferenceCancelledError } from '../errors/index.js';
function concatenateChunks(chunks) {
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const pcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
    }
    return pcm;
}
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
export function audioGen(params) {
    const parsed = parseClientInput(audioGenClientParamsSchema, params);
    const requestId = generateRandomRequestId();
    const request = {
        ...parsed,
        type: 'audioGenStream',
        requestId
    };
    return collectAudioRun(request, requestId, audioGenStreamResponseSchema);
}
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
export function audioEdit(params) {
    const parsed = parseClientInput(audioEditClientParamsSchema, params);
    const requestId = generateRandomRequestId();
    const request = {
        ...parsed,
        type: 'audioEditStream',
        requestId
    };
    return collectAudioRun(request, requestId, audioEditStreamResponseSchema);
}
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
export function audioUnderstand(params) {
    const parsed = parseClientInput(audioUnderstandClientParamsSchema, params);
    const requestId = generateRandomRequestId();
    const request = {
        ...parsed,
        type: 'audioUnderstand',
        requestId
    };
    let seen;
    const { progressStream, payload, stats, diagnostics } = collectRun(request, requestId, audioUnderstandResponseSchema, {
        absorb(frame) {
            if (frame.understand !== undefined)
                seen = frame.understand;
        },
        settle(frame) {
            const result = frame.stats?.understand ?? seen;
            if (result === undefined) {
                throw new InvalidResponseError('audioUnderstand description');
            }
            return result;
        }
    });
    return { requestId, progressStream, description: payload, stats, diagnostics };
}
function collectRun(request, requestId, responseSchema, sink) {
    const wireType = request.type;
    const progressQueue = [];
    let progressDone = false;
    let progressError;
    let progressResolve;
    let resolvePayload = () => { };
    let rejectPayload = () => { };
    const payload = new Promise((resolve, reject) => {
        resolvePayload = resolve;
        rejectPayload = reject;
    });
    payload.catch(() => { });
    let resolveStats = () => { };
    let rejectStats = () => { };
    const stats = new Promise((resolve, reject) => {
        resolveStats = resolve;
        rejectStats = reject;
    });
    stats.catch(() => { });
    let resolveDiagnostics = () => { };
    let rejectDiagnostics = () => { };
    const diagnostics = new Promise((resolve, reject) => {
        resolveDiagnostics = resolve;
        rejectDiagnostics = reject;
    });
    diagnostics.catch(() => { });
    function notifyProgress() {
        progressResolve?.();
        progressResolve = undefined;
    }
    function rejectAll(error) {
        rejectPayload(error);
        rejectStats(error);
        rejectDiagnostics(error);
    }
    async function processResponses() {
        let receivedDone = false;
        try {
            for await (const response of stream(request)) {
                if (!response ||
                    typeof response !== 'object' ||
                    !('type' in response) ||
                    response.type !== wireType) {
                    continue;
                }
                const frame = responseSchema.parse(response);
                if (frame.progress) {
                    progressQueue.push(frame.progress);
                    notifyProgress();
                }
                sink.absorb(frame);
                if (frame.done) {
                    receivedDone = true;
                    if (frame.stopReason === 'cancelled') {
                        rejectAll(new InferenceCancelledError(requestId));
                        break;
                    }
                    resolvePayload(sink.settle(frame));
                    resolveStats(frame.stats);
                    resolveDiagnostics(frame.diagnostics);
                    break;
                }
            }
            if (!receivedDone) {
                throw new InvalidResponseError(`${wireType} terminal response`);
            }
        }
        catch (error) {
            progressError = error instanceof Error ? error : new InvalidResponseError(wireType, error);
            rejectAll(progressError);
        }
        finally {
            progressDone = true;
            notifyProgress();
        }
    }
    async function* progressStream() {
        while (true) {
            const tick = progressQueue.shift();
            if (tick) {
                yield tick;
                continue;
            }
            if (progressDone) {
                if (progressError !== undefined)
                    throw progressError;
                return;
            }
            await new Promise((resolve) => {
                progressResolve = resolve;
            });
        }
    }
    void processResponses();
    return { requestId, progressStream: progressStream(), payload, stats, diagnostics };
}
/**
 * Consumes one generation or editing stream: PCM chunks accumulate into
 * `audio`, carrying the format reported alongside them.
 */
function collectAudioRun(request, requestId, responseSchema) {
    const wireType = request.type;
    const pcmChunks = [];
    let sampleRate;
    let channels;
    let bitsPerSample;
    const { progressStream, payload, stats, diagnostics } = collectRun(request, requestId, responseSchema, {
        absorb(frame) {
            if (frame.data === undefined)
                return;
            pcmChunks.push(decodeBase64(frame.data));
            sampleRate = frame.sampleRate;
            channels = frame.channels;
            bitsPerSample = frame.bitsPerSample;
        },
        settle() {
            if (sampleRate === undefined || channels === undefined || bitsPerSample === undefined) {
                throw new InvalidResponseError(`${wireType} audio chunk`);
            }
            return {
                pcm: concatenateChunks(pcmChunks),
                sampleRate,
                channels,
                bitsPerSample
            };
        }
    });
    return { requestId, progressStream, audio: payload, stats, diagnostics };
}
