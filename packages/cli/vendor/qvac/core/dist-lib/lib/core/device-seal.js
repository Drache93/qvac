import b4a from 'b4a';
import box from 'sodium-universal/crypto_box.js';
import sign from 'sodium-universal/crypto_sign.js';
export const SEALED_SEED_BYTES = 32 + box.crypto_box_SEALBYTES;
export function sealToDevice(message, deviceId) {
    const publicKey = b4a.alloc(box.crypto_box_PUBLICKEYBYTES);
    sign.crypto_sign_ed25519_pk_to_curve25519(publicKey, deviceId);
    const sealed = b4a.alloc(message.byteLength + box.crypto_box_SEALBYTES);
    box.crypto_box_seal(sealed, message, publicKey);
    return sealed;
}
export function openSealedToDevice(sealed, deviceKeyPair) {
    if (sealed.byteLength < box.crypto_box_SEALBYTES) {
        return null;
    }
    const publicKey = b4a.alloc(box.crypto_box_PUBLICKEYBYTES);
    const secretKey = b4a.alloc(box.crypto_box_SECRETKEYBYTES);
    sign.crypto_sign_ed25519_pk_to_curve25519(publicKey, deviceKeyPair.publicKey);
    sign.crypto_sign_ed25519_sk_to_curve25519(secretKey, deviceKeyPair.secretKey);
    const message = b4a.alloc(sealed.byteLength - box.crypto_box_SEALBYTES);
    return box.crypto_box_seal_open(message, sealed, publicKey, secretKey) ? message : null;
}
