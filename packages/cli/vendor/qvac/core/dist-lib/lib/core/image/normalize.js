export const MAX_IMAGE_WIDTH = 768;
export const IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/x-ms-bmp',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/tiff',
    'image/tif'
]);
let media;
async function loadMedia() {
    if (media !== undefined)
        return media;
    try {
        media = await import('bare-media');
    }
    catch {
        media = null;
    }
    return media;
}
export async function normalizeImageForModel(bytes) {
    const mod = await loadMedia();
    if (!mod) {
        return bytes;
    }
    try {
        const frame = firstFrame(await mod.image.decode(bytes));
        const oriented = await mod.image.orientate(frame, { file: bytes });
        const resized = await mod.image.resize(oriented, { maxWidth: MAX_IMAGE_WIDTH });
        return await mod.image.encode(resized, { mimetype: 'image/jpeg' });
    }
    catch {
        return bytes;
    }
}
export async function rasterToModelJpeg(raster) {
    const mod = await loadMedia();
    if (!mod) {
        return null;
    }
    const resized = await mod.image.resize(raster, { maxWidth: MAX_IMAGE_WIDTH });
    return mod.image.encode(resized, { mimetype: 'image/jpeg' });
}
function firstFrame(decoded) {
    if (!decoded.frames)
        return decoded;
    const [first] = decoded.frames;
    if (!first) {
        throw new Error('decoded image had no frames');
    }
    return first;
}
