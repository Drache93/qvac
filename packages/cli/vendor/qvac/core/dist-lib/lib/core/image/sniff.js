const HEIF_BRANDS = new Set([
    'heic',
    'heix',
    'heim',
    'heis',
    'hevc',
    'hevm',
    'hevs',
    'mif1',
    'msf1'
]);
const AVIF_BRANDS = new Set(['avif', 'avis']);
export function detectImageMime(bytes) {
    if (isPng(bytes))
        return 'image/png';
    if (isJpeg(bytes))
        return 'image/jpeg';
    if (isAvif(bytes)) {
        return 'image/avif';
    }
    if (isHeif(bytes)) {
        return 'image/heic';
    }
    if (isWebp(bytes)) {
        return 'image/webp';
    }
    if (isGif(bytes)) {
        return 'image/gif';
    }
    if (isBmp(bytes)) {
        return 'image/bmp';
    }
    if (isTiff(bytes)) {
        return 'image/tiff';
    }
    return null;
}
export function mapDeclaredToSniffed(declared) {
    const normalized = declared.toLowerCase();
    if (normalized === 'image/png') {
        return 'image/png';
    }
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
        return 'image/jpeg';
    }
    if (normalized === 'image/heic' || normalized === 'image/heif') {
        return 'image/heic';
    }
    if (normalized === 'image/avif') {
        return 'image/avif';
    }
    if (normalized === 'image/webp') {
        return 'image/webp';
    }
    if (normalized === 'image/gif') {
        return 'image/gif';
    }
    if (normalized === 'image/bmp' || normalized === 'image/x-ms-bmp') {
        return 'image/bmp';
    }
    if (normalized === 'image/tiff' || normalized === 'image/tif') {
        return 'image/tiff';
    }
    return null;
}
function isPng(bytes) {
    return (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a);
}
function isJpeg(bytes) {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
function isHeif(bytes) {
    if (bytes.length < 12)
        return false;
    if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
        return false;
    }
    const b8 = bytes[8];
    const b9 = bytes[9];
    const b10 = bytes[10];
    const b11 = bytes[11];
    if (b8 === undefined || b9 === undefined || b10 === undefined || b11 === undefined) {
        return false;
    }
    const brand = String.fromCharCode(b8, b9, b10, b11).toLowerCase();
    return HEIF_BRANDS.has(brand);
}
function isAvif(bytes) {
    if (bytes.length < 12)
        return false;
    if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
        return false;
    }
    const major = brandAt(bytes, 8);
    if (major && AVIF_BRANDS.has(major)) {
        return true;
    }
    const end = ftypBoxEnd(bytes);
    for (let offset = 16; offset + 4 <= end; offset += 4) {
        const compatible = brandAt(bytes, offset);
        if (compatible && AVIF_BRANDS.has(compatible)) {
            return true;
        }
    }
    return false;
}
function brandAt(bytes, offset) {
    const a = bytes[offset];
    const b = bytes[offset + 1];
    const c = bytes[offset + 2];
    const d = bytes[offset + 3];
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
        return null;
    }
    return String.fromCharCode(a, b, c, d).toLowerCase();
}
function ftypBoxEnd(bytes) {
    const s0 = bytes[0];
    const s1 = bytes[1];
    const s2 = bytes[2];
    const s3 = bytes[3];
    if (s0 === undefined || s1 === undefined || s2 === undefined || s3 === undefined) {
        return bytes.length;
    }
    const declared = s0 * 0x1000000 + (s1 << 16) + (s2 << 8) + s3;
    return declared > 8 && declared <= bytes.length ? declared : bytes.length;
}
function isWebp(bytes) {
    return (bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50);
}
function isGif(bytes) {
    if (bytes.length < 6)
        return false;
    if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46)
        return false;
    if (bytes[3] !== 0x38 || bytes[5] !== 0x61) {
        return false;
    }
    return bytes[4] === 0x37 || bytes[4] === 0x39;
}
function isBmp(bytes) {
    return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}
function isTiff(bytes) {
    if (bytes.length < 4)
        return false;
    if (bytes[0] === 0x49 && bytes[1] === 0x49) {
        return bytes[2] === 0x2a && bytes[3] === 0x00;
    }
    if (bytes[0] === 0x4d && bytes[1] === 0x4d) {
        return bytes[2] === 0x00 && bytes[3] === 0x2a;
    }
    return false;
}
