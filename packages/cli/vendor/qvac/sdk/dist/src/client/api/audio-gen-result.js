import { audioEditClientParamsSchema, audioEditStreamResponseSchema, audioGenClientParamsSchema, audioGenStreamResponseSchema, audioUnderstandClientParamsSchema, audioUnderstandResponseSchema } from '@qvac/inference/surface';
import { parseClientInput } from '../parse-input.js';
import { generateClientRequestId } from './client-request-id.js';
import { decodeBase64 } from '../../utils/encoding.js';
import { InvalidResponseError } from '../../utils/errors-client.js';
import { InferenceCancelledError } from '../../utils/errors-server.js';
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
export function createAudioGenResult(params, streamFactory) {
    const parsed = parseClientInput(audioGenClientParamsSchema, params);
    const requestId = generateClientRequestId();
    const request = {
        ...parsed,
        type: 'audioGenStream',
        requestId
    };
    return collectAudioRun(requestId, 'audioGenStream', audioGenStreamResponseSchema, () => streamFactory(request));
}
export function createAudioEditResult(params, streamFactory) {
    const parsed = parseClientInput(audioEditClientParamsSchema, params);
    const requestId = generateClientRequestId();
    const request = {
        ...parsed,
        type: 'audioEditStream',
        requestId
    };
    return collectAudioRun(requestId, 'audioEditStream', audioEditStreamResponseSchema, () => streamFactory(request));
}
export function createAudioUnderstandResult(params, streamFactory) {
    const parsed = parseClientInput(audioUnderstandClientParamsSchema, params);
    const requestId = generateClientRequestId();
    const request = {
        ...parsed,
        type: 'audioUnderstand',
        requestId
    };
    return collectUnderstandRun(requestId, () => streamFactory(request));
}
function collectRun(requestId, wireType, responseSchema, open, sink) {
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
            for await (const response of open()) {
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
                    const settled = sink.settle(frame);
                    resolvePayload(settled);
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
 * Consumes an `audioUnderstand()` stream: the engine streams the description
 * as one `understand` item and repeats it on the terminal stats.
 */
function collectUnderstandRun(requestId, openStream) {
    let seen;
    const { progressStream, payload, stats, diagnostics } = collectRun(requestId, 'audioUnderstand', audioUnderstandResponseSchema, openStream, {
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
/**
 * Consumes one generation or editing stream: PCM chunks accumulate into
 * `audio`, carrying the format reported alongside them.
 */
function collectAudioRun(requestId, wireType, responseSchema, open) {
    const pcmChunks = [];
    let sampleRate;
    let channels;
    let bitsPerSample;
    const { progressStream, payload, stats, diagnostics } = collectRun(requestId, wireType, responseSchema, open, {
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
