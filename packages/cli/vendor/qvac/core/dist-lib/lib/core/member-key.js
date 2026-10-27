import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import box from 'sodium-universal/crypto_box.js';
const MEMBER_BOX = b4a.from('member-box');
export function memberBoxKeyPair(accountSeed) {
    const publicKey = b4a.alloc(box.crypto_box_PUBLICKEYBYTES);
    const secretKey = b4a.alloc(box.crypto_box_SECRETKEYBYTES);
    box.crypto_box_seed_keypair(publicKey, secretKey, crypto.hash([MEMBER_BOX, accountSeed]));
    return { publicKey, secretKey };
}
export function sealToMember(message, boxKey) {
    const sealed = b4a.alloc(message.byteLength + box.crypto_box_SEALBYTES);
    box.crypto_box_seal(sealed, message, boxKey);
    return sealed;
}
export function openSealedToMember(sealed, keyPair) {
    if (sealed.byteLength < box.crypto_box_SEALBYTES) {
        return null;
    }
    const message = b4a.alloc(sealed.byteLength - box.crypto_box_SEALBYTES);
    return box.crypto_box_seal_open(message, sealed, keyPair.publicKey, keyPair.secretKey)
        ? message
        : null;
}
