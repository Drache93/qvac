import ffmpeg from 'bare-ffmpeg';
import b4a from 'b4a';
import { errorMessage } from '../../lib/guards.js';
import { HarnessLog } from '../../lib/log.js';
import { buildWavBuffer, TARGET_SAMPLE_RATE } from './wav-encode.js';
function bufferReadIO(input) {
    let offset = 0;
    return new ffmpeg.IOContext(b4a.alloc(4096), {
        onread: (buffer, requested) => {
            const remaining = input.length - offset;
            if (remaining <= 0) {
                return 0;
            }
            const n = Math.min(requested, remaining);
            buffer.set(input.subarray(offset, offset + n));
            offset += n;
            return n;
        },
        onseek: (o, whence) => {
            if (whence === ffmpeg.constants.seek.SIZE)
                return input.length;
            if (whence === ffmpeg.constants.seek.SET) {
                offset = o;
            }
            else if (whence === ffmpeg.constants.seek.CUR) {
                offset += o;
            }
            else if (whence === ffmpeg.constants.seek.END) {
                offset = input.length + o;
            }
            else {
                return -1;
            }
            return offset;
        }
    });
}
function makeOutFrame(capacity, rate) {
    const out = new ffmpeg.Frame();
    out.format = ffmpeg.constants.sampleFormats.S16;
    out.channelLayout = ffmpeg.constants.channelLayouts.MONO;
    out.sampleRate = rate;
    out.nbSamples = capacity;
    out.alloc();
    return out;
}
function readChunk(samples, outFrame, produced) {
    if (produced <= 0)
        return null;
    samples.read(outFrame);
    return b4a.from(samples.data.subarray(0, produced * 2));
}
function createResampler(frame, rate) {
    return new ffmpeg.Resampler(frame.sampleRate, frame.channelLayout, frame.format, rate, ffmpeg.constants.channelLayouts.MONO, ffmpeg.constants.sampleFormats.S16);
}
function convertFrame(resampler, { frame, samples, rate }) {
    const capacity = Math.ceil((frame.nbSamples * rate) / frame.sampleRate) + 1024;
    const outFrame = makeOutFrame(capacity, rate);
    const chunk = readChunk(samples, outFrame, resampler.convert(frame, outFrame));
    outFrame.destroy();
    return chunk;
}
function flushResampler(resampler, samples, rate) {
    if (!resampler)
        return [];
    const chunks = [];
    let flushed = 0;
    do {
        const outFrame = makeOutFrame(rate, rate);
        flushed = resampler.flush(outFrame);
        const chunk = readChunk(samples, outFrame, flushed);
        if (chunk) {
            chunks.push(chunk);
        }
        outFrame.destroy();
    } while (flushed > 0);
    return chunks;
}
function drainDecodedFrames(decoder, resampler, target) {
    const { frame, chunks, rate } = target;
    let current = resampler;
    while (decoder.receiveFrame(frame)) {
        current ??= createResampler(frame, rate);
        const chunk = convertFrame(current, target);
        if (chunk) {
            chunks.push(chunk);
        }
    }
    return current;
}
const YIELD_EVERY_PACKETS = 32;
function yieldToLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
async function* decodeToPcmChunks(inputFormat, { stream, decoder, rate }) {
    const packet = new ffmpeg.Packet();
    const flush = new ffmpeg.Packet();
    const frame = new ffmpeg.Frame();
    const samples = new ffmpeg.Samples();
    const target = { frame, samples, chunks: [], rate };
    let resampler = null;
    let packets = 0;
    try {
        while (inputFormat.readFrame(packet)) {
            if (packet.streamIndex === stream.index && decoder.sendPacket(packet)) {
                resampler = drainDecodedFrames(decoder, resampler, target);
            }
            packet.unref();
            yield* target.chunks.splice(0);
            if (++packets % YIELD_EVERY_PACKETS === 0) {
                await yieldToLoop();
            }
        }
        decoder.sendPacket(flush);
        resampler = drainDecodedFrames(decoder, resampler, target);
        yield* target.chunks.splice(0);
        yield* flushResampler(resampler, samples, rate);
    }
    finally {
        resampler?.destroy();
        frame.destroy();
        flush.destroy();
        packet.destroy();
    }
}
export async function* decodeToPcm16kMono(input) {
    const inputFormat = new ffmpeg.InputFormatContext(bufferReadIO(input));
    let decoder = null;
    try {
        const stream = inputFormat.getBestStream(ffmpeg.constants.mediaTypes.AUDIO);
        decoder = stream.decoder();
        decoder.open();
        yield* decodeToPcmChunks(inputFormat, { stream, decoder, rate: TARGET_SAMPLE_RATE });
    }
    finally {
        decoder?.destroy();
        inputFormat.destroy();
    }
}
export async function transcodeToWav16kMono(input) {
    const chunks = [];
    try {
        for await (const chunk of decodeToPcm16kMono(input)) {
            chunks.push(chunk);
        }
    }
    catch (e) {
        HarnessLog.warn('audio decode/resample failed', { error: errorMessage(e) });
        return null;
    }
    return chunks.length === 0 ? null : buildWavBuffer(b4a.concat(chunks));
}
