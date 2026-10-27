import { AbortedError } from '@qvac/harness/race-abort';
import { MAX_INLINE_BYTES } from '../store/index.js';
import b4a from 'b4a';
export async function previewEncoder() {
    let media;
    try {
        media = await import('bare-media');
    }
    catch {
        return null;
    }
    return async (bytes, signal) => {
        const decoded = await media.image.decode(bytes, { maxFrames: 1 });
        if (signal.aborted) {
            throw new AbortedError();
        }
        const first = decoded.frames ? decoded.frames[0] : decoded;
        if (!first) {
            throw new Error('image has no frames');
        }
        const upright = await media.image.orientate(first, { file: bytes });
        const resized = await media.image.resize(upright, { maxWidth: 768, maxHeight: 768 });
        if (signal.aborted) {
            throw new AbortedError();
        }
        try {
            return b4a.from(await media.image.encode(resized, {
                mimetype: 'image/jpeg',
                quality: 75,
                maxBytes: 80 * 1024
            }));
        }
        catch (error) {
            if (!(error instanceof Error) ||
                !error.message.startsWith('Could not create preview under maxBytes')) {
                throw error;
            }
            return b4a.from(await media.image.encode(resized, {
                mimetype: 'image/jpeg',
                quality: 60,
                maxBytes: MAX_INLINE_BYTES
            }));
        }
    };
}
