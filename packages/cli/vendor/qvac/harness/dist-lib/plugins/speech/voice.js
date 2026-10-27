import b4a from 'b4a';
import { errorMessage } from '../../lib/guards.js';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { HarnessError } from '../../lib/errors.js';
import { HarnessLog } from '../../lib/log.js';
import { normalizeForMoss, normalizeForSpeech } from './speech-text.js';
import { buildWavBuffer } from './wav-encode.js';
const NATIVE_SAMPLE_RATE = { supertonic: 44100, moss: 24000 };
const NORMALIZE = {
    supertonic: normalizeForSpeech,
    moss: normalizeForMoss
};
const TRANSCRIBE_SAMPLE_RATE = 16000;
const TRANSCRIBE_CHUNK_BYTES = TRANSCRIBE_SAMPLE_RATE * 2;
const TRANSCRIBE_STREAM_MIN_BYTES = TRANSCRIBE_CHUNK_BYTES * 60;
const TRANSCRIBE_SEGMENT_SECONDS = 300;
const PARAKEET_STREAMING = { emitPartials: false, chunkMs: 5000 };
const TRANSCRIBE_WITH_METADATA = false;
const TRANSCRIBE_PACE_MS = 40;
function pace(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function writePaced(session, pcm, signal) {
    for await (const second of pcm) {
        if (signal?.aborted)
            return;
        session.write(second);
        await pace(TRANSCRIBE_PACE_MS);
    }
}
export function transcribeOnce(sdk, modelId, audio) {
    return sdk.transcribe({ modelId, audioChunk: audio });
}
function transcribePiece(piece) {
    if (typeof piece === 'string') {
        const text = piece.trim();
        return text ? { text, append: false } : null;
    }
    if (piece.type === 'segment' && piece.segment) {
        const text = piece.segment.text.trim();
        return text ? { text, append: piece.segment.append } : null;
    }
    if (piece.type === 'text' && piece.text) {
        return { text: piece.text, append: true };
    }
    return null;
}
async function* inSeconds(pcm) {
    let pending = [];
    let size = 0;
    for await (const chunk of pcm) {
        pending.push(chunk);
        size += chunk.length;
        if (size < TRANSCRIBE_CHUNK_BYTES) {
            continue;
        }
        const joined = pending.length === 1 ? chunk : b4a.concat(pending);
        let offset = 0;
        for (; joined.length - offset >= TRANSCRIBE_CHUNK_BYTES; offset += TRANSCRIBE_CHUNK_BYTES) {
            yield joined.subarray(offset, offset + TRANSCRIBE_CHUNK_BYTES);
        }
        size = joined.length - offset;
        pending = size > 0 ? [joined.subarray(offset)] : [];
    }
    if (size > 0) {
        yield b4a.concat(pending);
    }
}
async function readHead(seconds, signal) {
    const head = { seconds: [], bytes: 0 };
    try {
        while (head.bytes < TRANSCRIBE_STREAM_MIN_BYTES && !signal?.aborted) {
            const next = await seconds.next();
            if (next.done) {
                break;
            }
            head.seconds.push(next.value);
            head.bytes += next.value.length;
        }
    }
    catch (err) {
        HarnessLog.warn('audio decode/resample failed', { error: errorMessage(err) });
        return null;
    }
    return head;
}
async function* resume(head, rest) {
    yield* head.seconds;
    yield* { [Symbol.asyncIterator]: () => rest };
}
export async function transcribeAudio(sdk, pcm, { modelId, signal, audio }) {
    const seconds = inSeconds(pcm);
    const head = await readHead(seconds, signal);
    if (signal?.aborted) {
        await seconds.return(undefined);
        throw new AbortedError();
    }
    if (!head || head.bytes === 0) {
        return transcribeOnce(sdk, modelId, audio);
    }
    if (head.bytes < TRANSCRIBE_STREAM_MIN_BYTES) {
        return transcribeOnce(sdk, modelId, buildWavBuffer(b4a.concat(head.seconds)));
    }
    try {
        return await transcribeStreaming(sdk, resume(head, seconds), { modelId, signal });
    }
    finally {
        await seconds.return(undefined);
    }
}
async function* segment(first, rest) {
    yield first;
    for (let n = 1; n < TRANSCRIBE_SEGMENT_SECONDS; n++) {
        const next = await rest.next();
        if (next.done) {
            return;
        }
        yield next.value;
    }
}
export async function transcribeStreaming(sdk, pcm, opts) {
    const seconds = pcm[Symbol.asyncIterator]();
    const parts = [];
    try {
        for (let first = await seconds.next(); !first.done; first = await seconds.next()) {
            parts.push(await transcribeSession(sdk, segment(first.value, seconds), opts));
        }
    }
    finally {
        await seconds.return?.();
    }
    return parts.filter(Boolean).join(' ');
}
async function transcribeSession(sdk, pcm, { modelId, signal }) {
    const session = await sdk.transcribeStream({
        modelId,
        metadata: TRANSCRIBE_WITH_METADATA,
        parakeetStreamingConfig: PARAKEET_STREAMING
    });
    const onAbort = () => session.destroy();
    signal?.addEventListener('abort', onAbort, { once: true });
    const collect = (async () => {
        let out = '';
        for await (const piece of session) {
            const seg = transcribePiece(piece);
            if (!seg) {
                continue;
            }
            out += !out || seg.append ? seg.text : ` ${seg.text}`;
        }
        return out.replace(/\s+/g, ' ').trim();
    })();
    collect.catch(noop);
    try {
        await writePaced(session, pcm, signal);
        if (!signal?.aborted) {
            session.end();
        }
        const text = await collect;
        if (signal?.aborted) {
            throw new AbortedError();
        }
        return text;
    }
    catch (err) {
        session.destroy();
        await collect.catch(noop);
        throw err;
    }
    finally {
        signal?.removeEventListener('abort', onAbort);
    }
}
export async function* speakStreamOnce(sdk, text, { modelId, engine = 'supertonic' }) {
    const session = await sdk.textToSpeechStream({
        modelId,
        inputType: 'text',
        accumulateSentences: false
    });
    let wrotePronounceable = false;
    let inputError = null;
    const pump = (async () => {
        try {
            for await (const fragment of text) {
                wrotePronounceable = writeSpeakable(session, fragment, engine) || wrotePronounceable;
            }
            session.end();
        }
        catch (err) {
            HarnessLog.warn('tts stream input failed', { err: errorMessage(err) });
            inputError = err;
            destroyQuietly(session);
        }
    })();
    let yieldedAudio = false;
    try {
        for await (const frame of session) {
            if (frame.buffer.length) {
                yieldedAudio = true;
                yield {
                    audio: packSamples(frame.buffer),
                    sampleRate: frame.sampleRate ?? NATIVE_SAMPLE_RATE[engine]
                };
            }
        }
        await pump;
        if (inputError) {
            throw inputError;
        }
        if (wrotePronounceable && !yieldedAudio) {
            throw new HarnessError('TTS_NO_AUDIO');
        }
    }
    catch (err) {
        throw inputError ?? err;
    }
    finally {
        destroyQuietly(session);
        await pump;
    }
}
function destroyQuietly(session) {
    try {
        session.destroy();
    }
    catch { }
}
function writeSpeakable(session, fragment, engine) {
    const spoken = speakable(fragment, engine);
    if (!/[\p{L}\p{N}]/u.test(spoken)) {
        return false;
    }
    session.write(b4a.from(/^\s/.test(fragment) ? ` ${spoken}` : spoken, 'utf8'));
    return true;
}
export function speakable(text, engine = 'supertonic') {
    const { text: spoken, dropped } = NORMALIZE[engine](text);
    if (dropped.length) {
        HarnessLog.info('tts dropped unspeakable characters', { chars: [...new Set(dropped)].join('') });
    }
    return spoken;
}
export async function speakOnce(sdk, text, { modelId, engine = 'supertonic' }) {
    const spoken = speakable(text, engine);
    if (!spoken) {
        return { audio: packSamples([]), sampleRate: NATIVE_SAMPLE_RATE[engine] };
    }
    const result = sdk.textToSpeech({ modelId, text: spoken, inputType: 'text', stream: true });
    const samples = [];
    for await (const sample of result.bufferStream) {
        samples.push(sample);
    }
    if (!(await result.done)) {
        throw new HarnessError('TTS_INCOMPLETE');
    }
    return {
        audio: packSamples(samples),
        sampleRate: (await result.sampleRate) ?? NATIVE_SAMPLE_RATE[engine]
    };
}
export function packSamples(samples) {
    const bytes = b4a.alloc(samples.length * 4);
    let offset = 0;
    for (const sample of samples) {
        b4a.writeFloatLE(bytes, sample / 32768, offset);
        offset += 4;
    }
    return bytes;
}
function noop() { }
