import c from 'compact-encoding';
import crypto from 'hypercore-crypto';
const [WRITER_CLAIM_NAMESPACE] = crypto.namespace('@qvac/core/device-writer-claim', 1);
export function signDeviceAttestation(secretKey, deviceId) {
    return { deviceId, signature: crypto.sign(deviceId, secretKey) };
}
export function verifyDeviceAttestation(publicKey, attestation) {
    try {
        return crypto.verify(attestation.deviceId, attestation.signature, publicKey);
    }
    catch {
        return false;
    }
}
function writerClaimMessage(binding) {
    const joinedAt = c.encode(c.uint, binding.joinedAt);
    return crypto.hash([
        WRITER_CLAIM_NAMESPACE,
        binding.meshPublicKey,
        binding.deviceId,
        binding.writerKey,
        joinedAt
    ]);
}
export function signWriterClaim(secretKey, binding) {
    return crypto.sign(writerClaimMessage(binding), secretKey);
}
export function verifyWriterClaim(signature, binding) {
    if (!signature)
        return false;
    try {
        return crypto.verify(writerClaimMessage(binding), signature, binding.deviceId);
    }
    catch {
        return false;
    }
}
const [MEMBER_WRITER_CLAIM_NAMESPACE] = crypto.namespace('@qvac/core/member-writer-claim', 1);
function memberWriterClaimMessage(binding) {
    return crypto.hash([
        MEMBER_WRITER_CLAIM_NAMESPACE,
        binding.meshPublicKey,
        binding.deviceId,
        binding.writerKey,
        c.encode(c.uint, binding.joinedAt),
        binding.memberId
    ]);
}
export function signMemberWriterClaim(secretKey, binding) {
    return crypto.sign(memberWriterClaimMessage(binding), secretKey);
}
export function verifyMemberWriterClaim(signature, binding) {
    if (!signature)
        return false;
    try {
        return crypto.verify(memberWriterClaimMessage(binding), signature, binding.deviceId);
    }
    catch {
        return false;
    }
}
