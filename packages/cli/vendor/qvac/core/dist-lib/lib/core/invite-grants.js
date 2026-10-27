import crypto from 'hypercore-crypto';
const [GRANT_KEYPAIR_NAMESPACE] = crypto.namespace('@qvac/core/mesh-invite-grant', 1);
const [INVITE_CLAIM_NAMESPACE] = crypto.namespace('@qvac/core/mesh-invite-claim', 1);
export const GRANT_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const GRANT_MAX_USES = 100;
export const INVITE_GRANT_NO_EXPIRY = 'An invite must expire';
export const INVITE_GRANT_TOO_LONG = 'An invite cannot expire more than 30 days after it is made';
export const INVITE_GRANT_USES_OUT_OF_RANGE = 'An invite admits between 1 and 100 people';
export function grantKeyPair(secret) {
    return crypto.keyPair(crypto.hash([GRANT_KEYPAIR_NAMESPACE, secret]));
}
function inviteClaimMessage(binding) {
    return crypto.hash([
        INVITE_CLAIM_NAMESPACE,
        binding.meshPublicKey,
        binding.grantKey,
        binding.deviceId,
        binding.writerKey
    ]);
}
export function inviteGrantTermsRefusal(terms, mintedAt) {
    const { expiresAt, maxUses } = terms;
    if (!expiresAt) {
        return INVITE_GRANT_NO_EXPIRY;
    }
    if (expiresAt > mintedAt + GRANT_MAX_TTL_MS) {
        return INVITE_GRANT_TOO_LONG;
    }
    if (!maxUses || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > GRANT_MAX_USES) {
        return INVITE_GRANT_USES_OUT_OF_RANGE;
    }
    return null;
}
export function signInviteClaim(secretKey, binding) {
    return crypto.sign(inviteClaimMessage(binding), secretKey);
}
export function verifyInviteClaim(signature, binding) {
    if (!signature)
        return false;
    try {
        return crypto.verify(inviteClaimMessage(binding), signature, binding.grantKey);
    }
    catch {
        return false;
    }
}
