import { createHash, randomBytes as defaultRandomBytes } from 'crypto';
import { bytesToBase64Url, randomBase64Url, sha256Base64Url } from '@qvac/core/oauth/runtime/crypto';
import b4a from 'b4a';
export function generatePkceChallenge(randomBytes) {
    const verifier = randomBytes ? bytesToBase64Url(randomBytes(32)) : randomBase64Url(32);
    const challenge = sha256Base64Url(verifier);
    return { verifier, challenge, method: 'S256' };
}
export function base64url(bytes) {
    return b4a.toString(b4a.from(bytes), 'base64url');
}
export function createPkce(randomBytes = defaultRandomBytes) {
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    return { verifier, challenge, method: 'S256' };
}
