import b4a from 'b4a';
const TARGET_SAMPLE_RATE = 16000;
const TARGET_CHANNELS = 1;
const TARGET_BITS_PER_SAMPLE = 16;
const WAV_PCM_FORMAT = 1;
export function wavFormat(bytes) {
    if (bytes.length < 44)
        return null;
    if (b4a.toString(bytes, 'ascii', 0, 4) !== 'RIFF')
        return null;
    if (b4a.toString(bytes, 'ascii', 8, 12) !== 'WAVE') {
        return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
        formatCode: view.getUint16(20, true),
        channels: view.getUint16(22, true),
        sampleRate: b4a.readUInt32LE(bytes, 24),
        bitsPerSample: view.getUint16(34, true)
    };
}
function wavNeedsResample(bytes) {
    const fmt = wavFormat(bytes);
    if (!fmt) {
        return true;
    }
    return (fmt.formatCode !== WAV_PCM_FORMAT ||
        fmt.channels !== TARGET_CHANNELS ||
        fmt.sampleRate !== TARGET_SAMPLE_RATE ||
        fmt.bitsPerSample !== TARGET_BITS_PER_SAMPLE);
}
export function needsResample(bytes) {
    if (bytes.length < 12)
        return false;
    if (b4a.toString(bytes, 'ascii', 0, 4) === 'RIFF' &&
        b4a.toString(bytes, 'ascii', 8, 12) === 'WAVE') {
        return wavNeedsResample(bytes);
    }
    if (b4a.toString(bytes, 'ascii', 4, 8) === 'ftyp')
        return true;
    if (b4a.toString(bytes, 'ascii', 0, 3) === 'ID3') {
        return true;
    }
    if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) {
        return true;
    }
    if (b4a.toString(bytes, 'ascii', 0, 4) === 'OggS') {
        return true;
    }
    if (b4a.toString(bytes, 'ascii', 0, 4) === 'fLaC') {
        return true;
    }
    return false;
}
export async function resampleForTranscription(bytes) {
    if (!needsResample(bytes)) {
        return { bytes, transcoded: false };
    }
    const { transcodeToWav16kMono } = await import('#audio-transcode');
    const wav = await transcodeToWav16kMono(bytes);
    return wav ? { bytes: wav, transcoded: true } : { bytes, transcoded: false };
}
function wavPcmData(bytes) {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const id = b4a.toString(bytes, 'ascii', offset, offset + 4);
        const size = b4a.readUInt32LE(bytes, offset + 4);
        const start = offset + 8;
        if (id === 'data') {
            return bytes.subarray(start, Math.min(start + size, bytes.length));
        }
        offset = start + size + (size & 1);
    }
    return null;
}
export async function* pcmForTranscription(bytes) {
    const pcm = wavFormat(bytes) && !needsResample(bytes) ? wavPcmData(bytes) : null;
    if (pcm) {
        yield pcm;
        return;
    }
    const { decodeToPcm16kMono } = await import('#audio-transcode');
    yield* decodeToPcm16kMono(bytes);
}
