import crypto from 'hypercore-crypto';
import { liveDeviceForWriter, trackActivity } from './activity.js';
import { nextGrantSequence, removedSinceMint } from './grant-order.js';
import { meshKind, sharedKind } from './mesh-kind.js';
import { isKickedRow } from '../helpers/index.js';
import { inviteGrantTermsRefusal, verifyInviteClaim } from '../invite-grants.js';
import { admitDevice } from './writers.js';
import { linkMember, outsideAccount, provenMember } from './members.js';
import { outsideProject } from './projects.js';
import b4a from 'b4a';
import { DEVICES, MESH_INVITE_GRANTS, MESH_INVITE_SPENDS, WRITER_ACTIVITY } from '../collections.js';
function hex(buffer) {
    return b4a.toHex(buffer).slice(0, 16);
}
async function kickedFromOutside(tx, device, memberId) {
    if (!device.revokedBy)
        return false;
    const activity = await tx.get(WRITER_ACTIVITY, {
        writerKey: device.revokedBy
    });
    const kicker = activity && (await tx.get(DEVICES, { id: activity.deviceId }));
    if (!kicker) {
        return false;
    }
    const kickerMember = kicker.memberId ?? kicker.claimedMemberId;
    return !kickerMember || !b4a.equals(kickerMember, memberId);
}
async function memberStanding(tx, memberId, grant) {
    if (await removedSinceMint(tx, memberId, grant))
        return 'removed';
    for await (const device of tx.find(DEVICES)) {
        if (device.revoked)
            continue;
        const member = device.memberId ?? device.claimedMemberId;
        if (member && b4a.equals(member, memberId)) {
            return 'present';
        }
    }
    return null;
}
async function inviteStanding(tx, { device, memberId, grant }) {
    const standing = await memberStanding(tx, memberId, grant);
    if (standing !== 'present') {
        return standing;
    }
    if (!(await sharedKind(tx))) {
        return null;
    }
    if (!device?.revoked) {
        return 'present';
    }
    return (await removedBy(tx, device)) === 'own-member' ? 'present' : null;
}
async function belongsToAnotherMember(tx, device, memberId) {
    if (!device?.memberId || b4a.equals(device.memberId, memberId))
        return false;
    return !device.revoked || (await removedBy(tx, device)) === 'another-member';
}
export async function removedBy(tx, device) {
    if (!isKickedRow(device))
        return 'itself';
    const owner = device.memberId ?? device.claimedMemberId;
    if (!owner) {
        return 'another-member';
    }
    return (await kickedFromOutside(tx, device, owner)) ? 'another-member' : 'own-member';
}
export function registerInviteRoutes(router) {
    router.add('@qvac/put-mesh-invite-grant', trackActivity(async ({ grant }, { tx, node, log }) => {
        if ((await meshKind(tx)) === 'account') {
            log?.warn('contract', 'put-mesh-invite-grant dropped: an account takes no grant');
            return;
        }
        const author = await liveDeviceForWriter(tx, node.key);
        if (!author) {
            log?.warn('contract', 'put-mesh-invite-grant dropped: the writer has no device row');
            return;
        }
        const existing = await tx.get(MESH_INVITE_GRANTS, {
            grantKey: grant.grantKey
        });
        if (!existing) {
            const refusal = inviteGrantTermsRefusal(grant, node.timestamp);
            if (refusal) {
                log?.warn('contract', 'put-mesh-invite-grant dropped: ' + refusal, {
                    grantKey: hex(grant.grantKey)
                });
                return;
            }
            const minted = {
                grantKey: grant.grantKey,
                kind: grant.kind,
                issuerDeviceId: author.id,
                issuerMemberId: author.memberId ?? null,
                issuedAt: node.timestamp,
                expiresAt: grant.expiresAt,
                maxUses: grant.maxUses,
                uses: 0,
                revokedAt: grant.revokedAt,
                revokedBy: grant.revokedAt ? node.key : null,
                updatedAt: grant.updatedAt,
                sequence: await nextGrantSequence(tx)
            };
            await tx.insert(MESH_INVITE_GRANTS, minted);
            log?.info('contract', 'invite grant minted', { grantKey: hex(grant.grantKey) });
            return minted;
        }
        if (!grant.revokedAt) {
            log?.debug('contract', 'put-mesh-invite-grant dropped: terms are fixed at the mint', {
                grantKey: hex(grant.grantKey)
            });
            return;
        }
        if (existing.revokedAt) {
            log?.debug('contract', 'put-mesh-invite-grant dropped: already revoked', {
                grantKey: hex(grant.grantKey)
            });
            return;
        }
        const revoked = {
            ...existing,
            revokedAt: grant.revokedAt,
            revokedBy: node.key,
            updatedAt: grant.updatedAt
        };
        await tx.insert(MESH_INVITE_GRANTS, revoked);
        log?.info('contract', 'invite grant revoked', { grantKey: hex(grant.grantKey) });
        return revoked;
    }));
    router.add('@qvac/claim-invite', trackActivity(async (payload, context) => {
        const { tx, node, host, meshPublicKey, log } = context;
        if ((await meshKind(tx)) === 'account') {
            log?.warn('contract', 'claim-invite dropped: an account takes no grant');
            return;
        }
        if (await outsideAccount(tx, payload.member?.id)) {
            log?.warn('contract', "claim-invite dropped: it names another member than the account's");
            return;
        }
        if (await outsideProject(tx, payload.member?.id)) {
            log?.warn('contract', "claim-invite dropped: it names no member on the project's list");
            return;
        }
        let valid = false;
        try {
            valid = crypto.verify(node.key, payload.signature, meshPublicKey);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            log?.warn('contract', 'claim-invite dropped: invalid writer-claim signature');
            return;
        }
        const deviceId = payload.deviceId;
        if (!deviceId) {
            log?.warn('contract', 'claim-invite dropped: a redemption is counted per device');
            return;
        }
        const ids = { grantKey: hex(payload.grantKey), device: hex(deviceId) };
        const grant = await tx.get(MESH_INVITE_GRANTS, {
            grantKey: payload.grantKey
        });
        if (!grant) {
            log?.warn('contract', 'claim-invite dropped: the mesh holds no such grant', ids);
            return;
        }
        if (grant.revokedAt) {
            log?.warn('contract', 'claim-invite dropped: the grant was revoked', ids);
            return;
        }
        const issuer = grant.issuerDeviceId && (await tx.get(DEVICES, { id: grant.issuerDeviceId }));
        if (!issuer || issuer.revoked) {
            log?.warn('contract', 'claim-invite dropped: the device that minted the grant is gone', ids);
            return;
        }
        if (!verifyInviteClaim(payload.inviteSignature, {
            meshPublicKey,
            grantKey: payload.grantKey,
            deviceId,
            writerKey: node.key
        })) {
            log?.warn('contract', 'claim-invite dropped: the claim does not hold the grant secret', ids);
            return;
        }
        const spent = await tx.get(MESH_INVITE_SPENDS, {
            grantKey: payload.grantKey,
            deviceId
        });
        const existing = await tx.get(DEVICES, { id: deviceId });
        if (spent && (!existing || existing.revoked)) {
            log?.warn('contract', 'claim-invite dropped: a revoked device may not replay its spend', ids);
            return;
        }
        if (!spent && grant.expiresAt && node.timestamp > grant.expiresAt) {
            log?.warn('contract', 'claim-invite dropped: the grant expired', ids);
            return;
        }
        if (!spent && grant.maxUses && (grant.uses ?? 0) >= grant.maxUses) {
            log?.warn('contract', 'claim-invite dropped: the grant is used up', ids);
            return;
        }
        if (existing && !existing.revoked && !spent) {
            log?.warn('contract', 'claim-invite dropped: the device is already live here', ids);
            return;
        }
        if (!payload.device || !payload.member || !payload.memberClaim) {
            log?.warn('contract', 'claim-invite dropped: no device profile and member claim', ids);
            return;
        }
        const memberId = payload.member.id;
        const proof = await provenMember(meshPublicKey, {
            deviceId,
            writerKey: node.key,
            memberId,
            claim: payload.memberClaim
        });
        if (!proof) {
            log?.warn('contract', 'claim-invite dropped: the member claim does not bind this writer', ids);
            return;
        }
        if (await belongsToAnotherMember(tx, existing, memberId)) {
            log?.warn('contract', 'claim-invite dropped: the device belongs to another member', ids);
            return;
        }
        const standing = spent
            ? null
            : await inviteStanding(tx, { device: existing, memberId, grant });
        if (standing === 'present') {
            log?.warn('contract', 'claim-invite dropped: the member is still present', ids);
            return;
        }
        if (standing === 'removed') {
            log?.warn('contract', 'claim-invite dropped: the member was removed after the mint', ids);
            return;
        }
        const admission = await admitDevice(context, payload.device, {
            id: deviceId,
            writerKey: node.key,
            claim: payload
        });
        if (admission === 'refused') {
            return;
        }
        if (!spent) {
            await tx.insert(MESH_INVITE_SPENDS, {
                grantKey: payload.grantKey,
                deviceId,
                spentAt: node.timestamp
            });
            await tx.insert(MESH_INVITE_GRANTS, {
                ...grant,
                uses: (grant.uses ?? 0) + 1
            });
        }
        const admitted = await tx.get(DEVICES, { id: deviceId });
        if (!admitted) {
            return;
        }
        await linkMember(tx, admitted, { member: payload.member, proof });
        await host.addWriter(node.key);
        log?.info('contract', 'invite redeemed', ids);
        return payload.device;
    }));
}
