import crypto from 'hypercore-crypto';
import { bareDeviceProof, claimAttestation, verifyDeviceProof, verifyMemberClaim, verifyRecoveryClaim } from '../identity.js';
import { isKickedRow } from '../helpers/index.js';
import { liveDeviceForWriter, trackActivity } from './activity.js';
import { accountKind, sharedKind } from './mesh-kind.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import { admitDevice } from './writers.js';
import b4a from 'b4a';
import { DEVICES, MEMBERS, MESH_FOUNDERS } from '../collections.js';
function hex(buffer) {
    return b4a.toHex(buffer).slice(0, 16);
}
export async function provenMember(meshPublicKey, { deviceId, writerKey, memberId, claim }) {
    const attestation = claimAttestation(meshPublicKey, deviceId, writerKey);
    if (!(await verifyMemberClaim(claim, { memberId, deviceId, attestation }))) {
        return null;
    }
    return bareDeviceProof(claim);
}
export async function accountMember(tx) {
    const founder = await tx.get(MESH_FOUNDERS, { id: 'mesh' });
    if (founder) {
        return founder.memberId;
    }
    let only = null;
    for await (const member of tx.find(MEMBERS)) {
        if (only) {
            return null;
        }
        only = member.id;
    }
    return only;
}
export async function outsideAccount(tx, memberId) {
    if ((await rulesVersion(tx)) < WORKSPACES_RULES || !(await accountKind(tx))) {
        return false;
    }
    const own = await accountMember(tx);
    return !own || !memberId || !b4a.equals(own, memberId);
}
export async function linkMember(tx, device, { member, proof }) {
    const existing = await tx.get(MEMBERS, { id: member.id });
    const joined = existing ?? {
        id: member.id,
        name: member.name,
        joinedAt: member.joinedAt,
        updatedAt: member.updatedAt
    };
    if (!existing) {
        await tx.insert(MEMBERS, joined);
    }
    await tx.insert(DEVICES, link(device, { memberId: member.id, proof, attestedAt: member.joinedAt }));
    return joined;
}
function link(device, { memberId, proof, attestedAt }) {
    return {
        ...device,
        memberId,
        memberProof: proof,
        attestedAt,
        claimedMemberId: null,
        inviteToken: null
    };
}
export function registerMemberRoutes(router) {
    router.add('@qvac/mint-member', trackActivity(async ({ member, proof }, { tx, node, log }) => {
        const minter = await liveDeviceForWriter(tx, node.key);
        if (!minter) {
            log?.warn('contract', 'mint-member dropped: the writer has no device row');
            return;
        }
        if (minter.memberId) {
            log?.warn('contract', 'mint-member dropped: the writer is already inside a member');
            return;
        }
        if (await tx.findOne(MEMBERS)) {
            log?.warn('contract', 'mint-member dropped: the mesh already holds a member');
            return;
        }
        if (!(await verifyDeviceProof(proof, { memberId: member.id, deviceId: minter.id }))) {
            log?.warn('contract', 'mint-member dropped: the proof does not root the minter at the member');
            return;
        }
        const minted = {
            id: member.id,
            name: member.name,
            joinedAt: member.joinedAt,
            updatedAt: member.updatedAt
        };
        await tx.insert(MEMBERS, minted);
        await tx.insert(MESH_FOUNDERS, { id: 'mesh', memberId: member.id });
        await tx.insert(DEVICES, link(minter, { memberId: member.id, proof, attestedAt: member.joinedAt }));
        log?.info('contract', 'member minted', { id: b4a.toHex(member.id).slice(0, 16) });
        return minted;
    }));
    router.add('@qvac/update-member', trackActivity(async ({ member }, { tx, node, log }) => {
        const author = await liveDeviceForWriter(tx, node.key);
        if (!author?.memberId || !b4a.equals(author.memberId, member.id)) {
            log?.warn('contract', 'update-member dropped: the writer is no device of this member');
            return;
        }
        const existing = await tx.get(MEMBERS, { id: member.id });
        if (!existing) {
            log?.debug('contract', 'update-member dropped: unknown member');
            return;
        }
        if (member.updatedAt < existing.updatedAt) {
            log?.debug('contract', 'update-member dropped: not newer than the stored row');
            return;
        }
        const next = {
            id: member.id,
            name: member.name,
            joinedAt: existing.joinedAt,
            updatedAt: member.updatedAt
        };
        await tx.insert(MEMBERS, next);
        return next;
    }));
    router.add('@qvac/join-member', trackActivity(async ({ member, proof }, context) => {
        const { tx, node, log, meshPublicKey } = context;
        if (await sharedKind(tx)) {
            log?.warn('contract', 'join-member dropped: a shared mesh links a device only at admission');
            return;
        }
        const author = await liveDeviceForWriter(tx, node.key);
        const ids = {
            writer: hex(node.key),
            device: author ? hex(author.id) : null,
            member: hex(member.id)
        };
        if (!author) {
            log?.warn('contract', 'join-member dropped: the writer has no device row', ids);
            return;
        }
        if (author.memberId) {
            if (b4a.equals(author.memberId, member.id)) {
                log?.debug('contract', 'join-member dropped: the device is already owned by this member', ids);
            }
            else {
                log?.warn('contract', 'join-member dropped: the device is owned by another member', {
                    ...ids,
                    owner: hex(author.memberId)
                });
            }
            return;
        }
        if (await outsideAccount(tx, member.id)) {
            log?.warn('contract', "join-member dropped: it names another member than the account's", ids);
            return;
        }
        const stored = await provenMember(meshPublicKey, {
            deviceId: author.id,
            writerKey: node.key,
            memberId: member.id,
            claim: proof
        });
        if (!stored) {
            log?.warn('contract', 'join-member dropped: the claim does not bind this mesh and writer', {
                ...ids,
                mesh: hex(meshPublicKey),
                proofBytes: proof.byteLength
            });
            return;
        }
        const joined = await linkMember(tx, author, { member, proof: stored });
        log?.info('contract', 'member joined', ids);
        return joined;
    }));
    router.add('@qvac/recover-device', trackActivity(async (payload, context) => {
        const { tx, node, host, log, meshPublicKey } = context;
        const { deviceId, memberId, proof } = payload;
        const ids = { writer: hex(node.key), device: hex(deviceId), member: hex(memberId) };
        let valid = false;
        try {
            valid = crypto.verify(node.key, payload.signature, meshPublicKey);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            log?.warn('contract', 'recover-device dropped: invalid writer-claim signature', ids);
            return;
        }
        if (await sharedKind(tx)) {
            log?.warn('contract', 'recover-device dropped: a shared mesh is not recovered into', ids);
            return;
        }
        if (await outsideAccount(tx, memberId)) {
            log?.warn('contract', "recover-device dropped: it names another member than the account's", ids);
            return;
        }
        if (!(await tx.get(MEMBERS, { id: memberId }))) {
            log?.warn('contract', 'recover-device dropped: the mesh holds no such member', ids);
            return;
        }
        const existing = await tx.get(DEVICES, { id: deviceId });
        if (existing && isKickedRow(existing)) {
            log?.warn('contract', 'recover-device dropped: the device was removed', ids);
            return;
        }
        if (existing?.memberId && !b4a.equals(existing.memberId, memberId)) {
            log?.warn('contract', 'recover-device dropped: the device is owned by another member', ids);
            return;
        }
        const recovered = await verifyRecoveryClaim(proof, {
            memberId,
            deviceId,
            attestation: claimAttestation(meshPublicKey, deviceId, node.key)
        });
        const deviceProof = recovered ? bareDeviceProof(proof) : null;
        if (!deviceProof) {
            log?.warn('contract', "recover-device dropped: the claim is not the identity's own", ids);
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
        await host.addWriter(node.key);
        const admitted = await tx.get(DEVICES, { id: deviceId });
        if (!admitted) {
            return;
        }
        await tx.insert(DEVICES, link(admitted, {
            memberId,
            proof: deviceProof,
            attestedAt: payload.device.joinedAt
        }));
        log?.info('contract', 'device recovered into its member', ids);
        return payload.device;
    }));
    router.add('@qvac/attest-member-device', async (op, { tx, node, log }) => {
        const device = await tx.get(DEVICES, { id: op.deviceId });
        if (!device) {
            log?.debug('contract', 'attest-member-device dropped: unknown device');
            return;
        }
        if (device.memberId && !b4a.equals(device.memberId, op.memberId)) {
            log?.warn('contract', 'attest-member-device dropped: a device may not change member');
            return;
        }
        const signer = await liveDeviceForWriter(tx, node.key);
        if (signer?.id && b4a.equals(signer?.id, op.deviceId) && (await sharedKind(tx))) {
            log?.warn('contract', 'attest-member-device dropped: a shared mesh links a device only at admission');
            return;
        }
        const speaksForMember = (!!signer?.memberId && b4a.equals(signer.memberId, op.memberId)) ||
            (!!signer?.id && b4a.equals(signer.id, op.deviceId));
        if (!speaksForMember) {
            log?.warn('contract', 'attest-member-device dropped: the writer speaks for another member');
            return;
        }
        const member = await tx.get(MEMBERS, { id: op.memberId });
        if (!member) {
            log?.debug('contract', 'attest-member-device dropped: no member row to attest into');
            return;
        }
        if (!(await verifyDeviceProof(op.proof, { memberId: op.memberId, deviceId: op.deviceId }))) {
            log?.warn('contract', 'attest-member-device dropped: the proof does not stand');
            return;
        }
        if (device.memberId &&
            b4a.equals(device.memberId, op.memberId) &&
            op.attestedAt <= (device.attestedAt || 0)) {
            log?.debug('contract', 'attest-member-device dropped: not newer than the stored attestation');
            return;
        }
        await tx.insert(DEVICES, link(device, { memberId: op.memberId, proof: op.proof, attestedAt: op.attestedAt }));
        log?.info('contract', 'device attested to a member', {
            id: b4a.toHex(op.deviceId).slice(0, 16)
        });
    });
}
