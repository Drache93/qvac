import b4a from 'b4a';
export const TARGET_SAMPLE_RATE = 16000;
export const WAV_HEADER_SIZE = 44;
export const BITS_PER_SAMPLE = 16;
export const CHANNELS = 1;
export function buildWavBuffer(pcm) {
    const dataSize = pcm.length;
    const buf = b4a.alloc(WAV_HEADER_SIZE + dataSize);
    const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
    b4a.write(buf, 'RIFF', 0, 'ascii');
    b4a.writeUInt32LE(buf, WAV_HEADER_SIZE + dataSize - 8, 4);
    b4a.write(buf, 'WAVE', 8, 'ascii');
    b4a.write(buf, 'fmt ', 12, 'ascii');
    b4a.writeUInt32LE(buf, 16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(CHANNELS, 22);
    b4a.writeUInt32LE(buf, TARGET_SAMPLE_RATE, 24);
    b4a.writeUInt32LE(buf, TARGET_SAMPLE_RATE * blockAlign, 28);
    buf.writeUInt16LE(blockAlign, 32);
    buf.writeUInt16LE(BITS_PER_SAMPLE, 34);
    b4a.write(buf, 'data', 36, 'ascii');
    b4a.writeUInt32LE(buf, dataSize, 40);
    buf.set(pcm, WAV_HEADER_SIZE);
    return buf;
}
