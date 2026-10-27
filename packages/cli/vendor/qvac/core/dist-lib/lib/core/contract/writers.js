import crypto from 'hypercore-crypto';
import { devicesByWriterKey, liveDeviceForWriter, markWriterRevoked, trackActivity } from './activity.js';
import { recordMemberRemoval } from './grant-order.js';
import { verifyMemberWriterClaim, verifyWriterClaim } from '../device-attestation.js';
import { meshKind, sharedKind } from './mesh-kind.js';
import { removedBy } from './invites.js';
import { outsideAccount } from './members.js';
import { addedSince, outsideProject } from './projects.js';
import { dropMemberAgents, dropMemberCopies } from './agents.js';
import { dropDeviceSeeds } from './public-seeds.js';
import { dropDeviceHostKeys } from './project-host-keys.js';
import { dropDeviceKeysOf } from './project-device-keys.js';
import { dropHostRows, hostedDevice, releaseHostedDevice } from './agent-join.js';
import { actsFor, dropRole, kicksAdminsLastDevice, leavesNoAdmin, uncountMember } from './workspace.js';
import { verifyDeviceProof } from '../identity.js';
import { sealed } from './seal.js';
import b4a from 'b4a';
import { DEVICES, MEMBERS, MESH_INVITE_GRANTS, PROJECT_MEMBERS } from '../collections.js';
async function boundToAnother(tx, writerKey, id) {
    for await (const device of devicesByWriterKey(tx, writerKey)) {
        if (!b4a.equals(device.id, id))
            return true;
    }
    return false;
}
export async function admitDevice({ tx, node, host, meshPublicKey, log }, device, { id, writerKey, claim }) {
    const hosted = await hostedDevice(tx, id);
    const existing = await tx.get(DEVICES, { id });
    if ((await sharedKind(tx)) && (await boundToAnother(tx, writerKey, id))) {
        log?.warn('contract', 'admission refused: another device is bound to this writer key', {
            id: b4a.toHex(id).slice(0, 16)
        });
        return 'refused';
    }
    if (!device) {
        if (!existing && !hosted) {
            return 'writer-only';
        }
        log?.debug('contract', 'admission refused: no profile to weigh against the existing row');
        return 'refused';
    }
    const signed = verifyWriterClaim(claim?.deviceSignature, {
        meshPublicKey,
        deviceId: id,
        writerKey,
        joinedAt: device.joinedAt
    });
    const bound = existing?.writerKey ?? null;
    const rebinding = bound !== null && !b4a.equals(bound, writerKey);
    const alreadyAdmitted = bound !== null && !rebinding && !existing?.revoked;
    const reclaims = signed && existing && !existing.deviceSignature;
    if (existing &&
        !reclaims &&
        (existing.revoked ? device.joinedAt <= existing.joinedAt : device.joinedAt < existing.joinedAt)) {
        log?.debug('contract', 'admission refused: claim is not newer than the device row');
        return 'refused';
    }
    if (alreadyAdmitted && !b4a.equals(node.key, writerKey)) {
        log?.warn('contract', 'admission refused: another writer may not rewrite a live device row', {
            id: b4a.toHex(id).slice(0, 16)
        });
        return 'refused';
    }
    if (!signed && (rebinding || (await sealed(tx)))) {
        log?.warn('contract', 'admission refused: the device did not sign for this writer key', {
            id: b4a.toHex(id).slice(0, 16)
        });
        return 'refused';
    }
    if (hosted) {
        if (!signed) {
            log?.warn('contract', 'admission refused: a model host holds this device id', {
                id: b4a.toHex(id).slice(0, 16)
            });
            return 'refused';
        }
        await releaseHostedDevice({ tx, host }, id, writerKey);
    }
    await tx.insert(DEVICES, {
        ...existing,
        name: device.name,
        joinedAt: device.joinedAt,
        capabilityProfile: device.capabilityProfile,
        recommendedModelName: device.recommendedModelName,
        installedToolNames: device.installedToolNames ?? existing?.installedToolNames,
        installedSkillNames: device.installedSkillNames ?? existing?.installedSkillNames,
        installedModelNames: device.installedModelNames ?? existing?.installedModelNames,
        cachedModelNames: device.cachedModelNames ?? existing?.cachedModelNames,
        readySkillNames: device.readySkillNames ?? existing?.readySkillNames,
        appVersion: device.appVersion ?? existing?.appVersion,
        appBuild: device.appBuild ?? existing?.appBuild,
        appChannel: device.appChannel ?? existing?.appChannel,
        platform: device.platform ?? existing?.platform,
        deviceSignature: signed ? claim?.deviceSignature : existing?.deviceSignature,
        claimedMemberId: claim?.claimedMemberId ?? existing?.claimedMemberId,
        inviteToken: claim?.inviteToken ?? existing?.inviteToken,
        id,
        writerKey,
        revoked: false,
        revokedAt: 0,
        revokedBy: null
    });
    if (rebinding) {
        await host.removeWriter(bound);
        await markWriterRevoked(tx, bound, { revoked: true });
    }
    await markWriterRevoked(tx, writerKey, { revoked: false });
    if (!alreadyAdmitted) {
        log?.debug('contract', 'device admitted', { id: b4a.toHex(id).slice(0, 16) });
    }
    return 'admitted';
}
async function hasStanding({ tx, node }) {
    const author = await liveDeviceForWriter(tx, node.key);
    if (!author?.memberId) {
        return false;
    }
    return (await tx.get(MEMBERS, { id: author.memberId })) !== null;
}
async function revokeIssuedGrants({ tx, node }, issued) {
    const live = [];
    for await (const grant of tx.find(MESH_INVITE_GRANTS)) {
        if (!grant.revokedAt && issued(grant)) {
            live.push(grant);
        }
    }
    for (const grant of live) {
        await tx.insert(MESH_INVITE_GRANTS, {
            ...grant,
            revokedAt: node.timestamp,
            revokedBy: node.key
        });
    }
}
async function deviceOwner({ tx }, { deviceId }) {
    const device = deviceId ? await tx.get(DEVICES, { id: deviceId }) : null;
    return device?.memberId ?? device?.claimedMemberId ?? null;
}
async function revokeWriter(payload, context) {
    await context.host.removeWriter(payload.writerKey);
    await dropHostRows(context.tx, payload.writerKey);
    const id = payload.deviceId;
    if (!id) {
        return;
    }
    const existing = await context.tx.get(DEVICES, { id });
    if (!existing) {
        context.log?.debug('contract', 'remove-writer: no device row to revoke');
        return;
    }
    if (existing.revoked && b4a.equals(context.node.key, payload.writerKey)) {
        context.log?.debug('contract', 'remove-writer: already revoked, the leave changes nothing');
        return;
    }
    const current = existing.writerKey;
    if (current && !b4a.equals(current, payload.writerKey)) {
        if (b4a.equals(context.node.key, payload.writerKey) || b4a.equals(context.node.key, current)) {
            context.log?.debug('contract', 'remove-writer dropped: writer key already superseded');
            return;
        }
        await context.host.removeWriter(current);
    }
    const revoked = {
        ...existing,
        revoked: true,
        revokedAt: payload.revokedAt ?? 0,
        revokedBy: context.node.key
    };
    await context.tx.insert(DEVICES, revoked);
    await markWriterRevoked(context.tx, current ?? payload.writerKey, { revoked: true });
    await dropDeviceSeeds(context.tx, id);
    await dropDeviceHostKeys(context.tx, id);
    await dropDeviceKeysOf(context.tx, id);
    context.log?.info('contract', 'writer removed, device revoked', {
        id: b4a.toHex(id).slice(0, 16)
    });
    await revokeIssuedGrants(context, (grant) => !!grant.issuerDeviceId && b4a.equals(grant.issuerDeviceId, id));
    const owner = existing.memberId ?? existing.claimedMemberId;
    const kicker = owner && (await liveDeviceForWriter(context.tx, context.node.key));
    const kickerMember = kicker ? (kicker.memberId ?? kicker.claimedMemberId) : null;
    if (owner && kicker && !(kickerMember && b4a.equals(kickerMember, owner))) {
        await recordMemberRemoval(context.tx, owner);
    }
    if (b4a.equals(context.node.key, payload.writerKey)) {
        return;
    }
    return revoked;
}
export function registerWriterRoutes(router) {
    router.add('@qvac/add-writer', trackActivity(async (payload, context) => {
        if (await meshKind(context.tx)) {
            context.log?.warn('contract', 'add-writer dropped: this mesh admits no writer through it');
            return;
        }
        if (!payload.device) {
            if (await sharedKind(context.tx)) {
                context.log?.warn('contract', 'add-writer dropped: a shared mesh admits no device-less writer');
                return;
            }
            await context.host.addWriter(payload.writerKey);
            return;
        }
        const existing = await context.tx.get(DEVICES, { id: payload.device.id });
        const signedLive = existing && !existing.revoked && existing.deviceSignature;
        const bound = signedLive ? existing.writerKey : null;
        if (bound && !b4a.equals(bound, payload.writerKey)) {
            context.log?.warn('contract', 'add-writer dropped: it may not move a live device');
            return;
        }
        const admission = await admitDevice(context, payload.device, {
            id: payload.device.id,
            writerKey: payload.writerKey,
            claim: payload
        });
        if (admission !== 'admitted') {
            return;
        }
        await context.host.addWriter(payload.writerKey);
        return payload.device;
    }));
    router.add('@qvac/remove-writer', trackActivity(async (payload, context) => {
        const self = b4a.equals(context.node.key, payload.writerKey);
        if (!self && !(await hasStanding(context))) {
            context.log?.warn('contract', 'remove-writer dropped: the author speaks for no member here');
            return;
        }
        if (!self && !(await actsFor(context, await deviceOwner(context, payload)))) {
            context.log?.warn('contract', "remove-writer dropped: only an admin kicks another's device");
            return;
        }
        if (!self && (await kicksAdminsLastDevice(context, payload.deviceId))) {
            context.log?.warn('contract', "remove-writer dropped: it would unpair an admin's last device");
            return;
        }
        return revokeWriter(payload, context);
    }));
    router.add('@qvac/remove-member', trackActivity(async ({ memberId, revokedAt }, context) => {
        if (!(await hasStanding(context))) {
            context.log?.warn('contract', 'remove-member dropped: the author speaks for no member here');
            return;
        }
        if (!(await actsFor(context, memberId))) {
            context.log?.warn('contract', 'remove-member dropped: only an admin removes another member');
            return;
        }
        if (await leavesNoAdmin(context, memberId)) {
            context.log?.warn('contract', 'remove-member dropped: the last admin cannot leave others');
            return;
        }
        if (revokedAt && (await addedSince(context.tx, memberId, revokedAt))) {
            context.log?.debug('contract', 'remove-member dropped: the member was added back since');
            return;
        }
        await dropRole(context.tx, memberId);
        await uncountMember(context.tx, memberId);
        await context.tx.delete(PROJECT_MEMBERS, { memberId });
        const removals = [];
        const devices = [];
        for await (const device of context.tx.find(DEVICES)) {
            const claims = device.memberId ?? device.claimedMemberId;
            if (!claims || !b4a.equals(claims, memberId)) {
                continue;
            }
            devices.push(device.id);
            if (!device.revoked && device.writerKey) {
                removals.push({ writerKey: device.writerKey, deviceId: device.id, revokedAt });
            }
        }
        let removed;
        for (const removal of removals) {
            removed = (await revokeWriter(removal, context)) ?? removed;
        }
        await revokeIssuedGrants(context, (grant) => !!grant.issuerMemberId && b4a.equals(grant.issuerMemberId, memberId));
        await dropMemberAgents(context.tx, memberId);
        await dropMemberCopies(context.tx, devices, revokedAt ?? 0);
        return removed;
    }));
    router.add('@qvac/join', trackActivity(async (payload, context) => {
        const kind = await meshKind(context.tx);
        if (kind === 'account' || (await sharedKind(context.tx))) {
            context.log?.warn('contract', 'join dropped: this mesh admits no bare join', { kind });
            return;
        }
        if (await outsideAccount(context.tx, null)) {
            context.log?.warn('contract', 'join dropped: an account admits no bare join');
            return;
        }
        let valid = false;
        try {
            valid = crypto.verify(context.node.key, payload.signature, context.meshPublicKey);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            context.log?.warn('contract', 'join dropped: invalid writer-claim signature');
            return;
        }
        const id = payload.deviceId;
        if (!id) {
            await context.host.addWriter(context.node.key);
            return;
        }
        const admission = await admitDevice(context, payload.device, {
            id,
            writerKey: context.node.key,
            claim: payload
        });
        if (admission === 'refused') {
            return;
        }
        await context.host.addWriter(context.node.key);
        return admission === 'admitted' ? payload.device : null;
    }));
    router.add('@qvac/vouched-join', trackActivity(async (payload, context) => {
        const { tx, node, meshPublicKey, log } = context;
        const { deviceId: id, device, writerKey } = payload;
        if (!id || !device || !writerKey) {
            log?.warn('contract', 'vouched-join dropped: no device and writer to admit');
            return;
        }
        let valid = false;
        try {
            valid = crypto.verify(writerKey, payload.signature, meshPublicKey);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            log?.warn('contract', 'vouched-join dropped: invalid writer-claim signature');
            return;
        }
        const voucher = await liveDeviceForWriter(tx, node.key);
        const memberId = voucher?.memberId;
        if (!memberId) {
            log?.warn('contract', 'vouched-join dropped: the writer is not a live linked device here');
            return;
        }
        if (await outsideProject(tx, memberId)) {
            log?.warn('contract', "vouched-join dropped: the voucher's member is not on the project's list");
            return;
        }
        const claim = { meshPublicKey, deviceId: id, writerKey, joinedAt: device.joinedAt, memberId };
        if (!verifyMemberWriterClaim(payload.memberSignature, claim)) {
            log?.warn('contract', 'vouched-join dropped: the joiner did not sign into this member');
            return;
        }
        const existing = await tx.get(DEVICES, { id });
        if (existing?.revoked &&
            (await sharedKind(tx)) &&
            (await removedBy(tx, existing)) === 'another-member') {
            log?.warn('contract', 'vouched-join dropped: the joiner was removed from this mesh');
            return;
        }
        if (existing &&
            !existing.revoked &&
            !(existing.writerKey && b4a.equals(existing.writerKey, writerKey)) &&
            !(device.joinedAt > existing.joinedAt)) {
            log?.warn('contract', 'vouched-join dropped: the joiner is live here on another writer');
            return;
        }
        const admission = await admitDevice(context, device, { id, writerKey, claim: payload });
        if (admission === 'refused') {
            return;
        }
        await context.host.addWriter(writerKey);
        const admitted = await tx.get(DEVICES, { id });
        if (!admitted) {
            return;
        }
        const proven = payload.memberProof &&
            (await verifyDeviceProof(payload.memberProof, { memberId, deviceId: id }));
        await tx.insert(DEVICES, {
            ...admitted,
            memberId,
            memberProof: proven ? payload.memberProof : admitted.memberProof
        });
        return device;
    }));
}
