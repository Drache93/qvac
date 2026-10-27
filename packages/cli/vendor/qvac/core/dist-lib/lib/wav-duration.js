const WAV_FORMAT_PCM = 1;
const WAV_FORMAT_IEEE_FLOAT = 3;
const RIFF_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
function ascii(bytes, start, end) {
    let out = '';
    for (let i = start; i < end; i++) {
        out += String.fromCharCode(bytes[i] ?? 0);
    }
    return out;
}
function readWavHeader(head) {
    if (head.length < RIFF_HEADER_BYTES)
        return null;
    if (ascii(head, 0, 4) !== 'RIFF' || ascii(head, 8, 12) !== 'WAVE')
        return null;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let fmt = null;
    let offset = RIFF_HEADER_BYTES;
    while (offset + CHUNK_HEADER_BYTES <= head.length) {
        const id = ascii(head, offset, offset + 4);
        const size = view.getUint32(offset + 4, true);
        const start = offset + CHUNK_HEADER_BYTES;
        if (id === 'fmt ' && start + 16 <= head.length) {
            fmt = {
                format: view.getUint16(start, true),
                channels: view.getUint16(start + 2, true),
                sampleRate: view.getUint32(start + 4, true),
                bitsPerSample: view.getUint16(start + 14, true)
            };
        }
        else if (id === 'data') {
            return fmt ? { ...fmt, dataStart: start, dataSize: size } : null;
        }
        offset = start + size + (size & 1);
    }
    return null;
}
export function wavDurationSeconds(head, totalBytes) {
    const header = readWavHeader(head);
    if (!header) {
        return null;
    }
    if (header.format !== WAV_FORMAT_PCM && header.format !== WAV_FORMAT_IEEE_FLOAT) {
        return null;
    }
    const frameBytes = header.channels * (header.bitsPerSample / 8);
    if (!(frameBytes > 0) || !(header.sampleRate > 0)) {
        return null;
    }
    const available = totalBytes - header.dataStart;
    if (!(available > 0)) {
        return null;
    }
    const dataBytes = header.dataSize > 0 && header.dataSize <= available ? header.dataSize : available;
    const seconds = dataBytes / (header.sampleRate * frameBytes);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
