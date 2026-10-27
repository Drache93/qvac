import b4a from 'b4a';
import crypto from 'hypercore-crypto';
export function randomId() {
    return b4a.toHex(crypto.randomBytes(16));
}
export function derivedId(...parts) {
    return b4a.toHex(crypto.hash(parts.map((part) => b4a.from(part))).subarray(0, 16));
}
