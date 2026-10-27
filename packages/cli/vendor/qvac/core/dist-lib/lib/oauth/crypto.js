import { createHash, randomBytes } from 'crypto';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function bytesToBase64Url(bytes) {
    let output = '';
    for (let index = 0; index < bytes.length; index += 3) {
        const first = bytes[index] ?? 0;
        const second = bytes[index + 1] ?? 0;
        const third = bytes[index + 2] ?? 0;
        output += BASE64URL[first >> 2];
        output += BASE64URL[((first & 0x03) << 4) | (second >> 4)];
        if (index + 1 < bytes.length) {
            output += BASE64URL[((second & 0x0f) << 2) | (third >> 6)];
        }
        if (index + 2 < bytes.length) {
            output += BASE64URL[third & 0x3f];
        }
    }
    return output;
}
export function randomBase64Url(size) {
    return bytesToBase64Url(randomBytes(size));
}
export function sha256Base64Url(value) {
    return createHash('sha256').update(value).digest('base64url');
}
