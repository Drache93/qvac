import b4a from 'b4a';
import c from 'compact-encoding';
import crypto from 'hypercore-crypto';
import { ProofEncoding } from 'keet-identity-key/lib/encoding.js';
export const MAX_PROOF_BYTES = 1024;
const [CLAIM_NAMESPACE] = crypto.namespace('@qvac/core/member-claim', 1);
const [ANCHOR_NAMESPACE] = crypto.namespace('@qvac/core/pairing-anchor', 1);
let loaded = null;
async function identityKey() {
    if (loaded === null) {
        loaded = await import('keet-identity-key');
    }
    return loaded.default;
}
export async function generateMnemonic() {
    return (await identityKey()).generateMnemonic();
}
export async function openIdentity(mnemonic) {
    return (await identityKey()).from({ mnemonic });
}
export async function mintIdentity(mnemonic, devicePublicKey) {
    const identity = await openIdentity(mnemonic);
    return { publicKey: identity.identityPublicKey, proof: await identity.bootstrap(devicePublicKey) };
}
export async function attestDeviceProof(devicePublicKey, parent, parentProof) {
    if (!parentProof)
        throw new Error('attestDeviceProof needs the parent proof');
    return (await identityKey()).attestDevice(devicePublicKey, parent, parentProof);
}
export function pairingAnchorSeed(accountSeed, memberId) {
    return crypto.hash([ANCHOR_NAMESPACE, accountSeed, memberId]);
}
export function chainTo(proof, publicKey) {
    let decoded;
    try {
        decoded = c.decode(ProofEncoding, proof);
    }
    catch {
        return null;
    }
    const at = decoded.chain.findIndex((link) => b4a.equals(link.publicKey, publicKey));
    if (at === -1) {
        return null;
    }
    return c.encode(ProofEncoding, { ...decoded, chain: decoded.chain.slice(0, at + 1) });
}
export async function delegationFits(proof, delegate) {
    const device = crypto.keyPair();
    const extended = await attestDeviceProof(device.publicKey, delegate, proof);
    const claim = await attestMemberClaim(crypto.randomBytes(32), device, extended);
    return claim.byteLength <= MAX_PROOF_BYTES;
}
export async function verifyDeviceProof(proof, expected) {
    if (proof.byteLength > MAX_PROOF_BYTES)
        return false;
    let decoded;
    try {
        decoded = c.decode(ProofEncoding, proof);
    }
    catch {
        return false;
    }
    if (decoded.data) {
        return false;
    }
    try {
        const IdentityKey = await identityKey();
        return !!IdentityKey.verify(proof, null, {
            expectedIdentity: expected.memberId,
            expectedDevice: expected.deviceId
        });
    }
    catch {
        return false;
    }
}
export function claimAttestation(meshPublicKey, deviceId, writerKey) {
    return crypto.hash([CLAIM_NAMESPACE, meshPublicKey, deviceId, writerKey]);
}
export async function attestMemberClaim(attestation, deviceKeyPair, deviceProof) {
    return (await identityKey()).attestData(attestation, deviceKeyPair, deviceProof);
}
export async function verifyMemberClaim(proof, expected) {
    if (proof.byteLength > MAX_PROOF_BYTES)
        return false;
    let decoded;
    try {
        decoded = c.decode(ProofEncoding, proof);
    }
    catch {
        return false;
    }
    if (!decoded.data) {
        return false;
    }
    try {
        const IdentityKey = await identityKey();
        return !!IdentityKey.verify(proof, expected.attestation, {
            expectedIdentity: expected.memberId,
            expectedDevice: expected.deviceId
        });
    }
    catch {
        return false;
    }
}
export async function verifyRecoveryClaim(proof, expected) {
    if (!(await verifyMemberClaim(proof, expected)))
        return false;
    return c.decode(ProofEncoding, proof).chain.length === 1;
}
export function bareDeviceProof(proof) {
    let decoded;
    try {
        decoded = c.decode(ProofEncoding, proof);
    }
    catch {
        return null;
    }
    return c.encode(ProofEncoding, { ...decoded, data: null });
}
