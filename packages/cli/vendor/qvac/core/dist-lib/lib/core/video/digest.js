import b4a from 'b4a';
import * as z from 'zod';
export const VIDEO_DIGEST_MIME = 'application/vnd.qvac.video-frames';
export const VIDEO_AUDIO = ['none', 'silent', 'speech', 'unheard'];
const HEADER_BYTES = 4;
const VideoDigestHeaderSchema = z.object({
    duration: z.number().nonnegative(),
    times: z.array(z.number().nonnegative()),
    audio: z.enum(VIDEO_AUDIO),
    transcript: z.string().optional()
});
const HeaderSchema = VideoDigestHeaderSchema.extend({
    version: z.literal(1),
    sizes: z.array(z.number().int().positive())
});
export function parseVideoDigestHeader(json) {
    return VideoDigestHeaderSchema.parse(JSON.parse(json));
}
export function videoDigestFileName(videoFileName) {
    return `${videoFileName}.frames`;
}
export function packVideoDigest(digest) {
    const header = b4a.from(JSON.stringify({
        version: 1,
        duration: digest.duration,
        times: digest.times,
        sizes: digest.frames.map((frame) => frame.byteLength),
        audio: digest.audio,
        transcript: digest.transcript
    }));
    const length = b4a.alloc(HEADER_BYTES);
    b4a.writeUInt32LE(length, header.byteLength, 0);
    return b4a.concat([length, header, ...digest.frames]);
}
export function unpackVideoDigest(bytes) {
    const length = b4a.readUInt32LE(bytes, 0);
    const header = HeaderSchema.parse(JSON.parse(b4a.toString(bytes.subarray(HEADER_BYTES, HEADER_BYTES + length))));
    if (header.sizes.length !== header.times.length) {
        throw new Error('video digest: a frame time without its frame');
    }
    let offset = HEADER_BYTES + length;
    const frames = header.sizes.map((size) => {
        const frame = bytes.subarray(offset, offset + size);
        offset += size;
        return frame;
    });
    if (offset !== bytes.byteLength) {
        throw new Error('video digest: frames do not fill the blob');
    }
    return {
        duration: header.duration,
        times: header.times,
        audio: header.audio,
        transcript: header.transcript,
        frames
    };
}
