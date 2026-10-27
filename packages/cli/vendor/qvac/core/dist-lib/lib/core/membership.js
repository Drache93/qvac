import b4a from 'b4a';
import { attestDeviceProof, attestMemberClaim, claimAttestation } from './identity.js';
import { sharedKind } from './contract/mesh-kind.js';
import { DEVICES, MEMBERS } from './collections.js';
export async function membershipView(mesh, deviceId) {
    const snap = mesh.view.snapshot();
    try {
        let members = 0;
        let own = null;
        const unattested = [];
        for await (const _member of snap.find(MEMBERS)) {
            members++;
        }
        for await (const device of snap.find(DEVICES)) {
            if (b4a.equals(device.id, deviceId)) {
                own = device;
            }
            else if (!device.revoked && !device.memberId) {
                unattested.push(device);
            }
        }
        return { members, own, unattested };
    }
    finally {
        await snap.close();
    }
}
export async function claimOwnMembership(mesh, { deviceKeyPair, log }, known) {
    const deviceId = deviceKeyPair.publicKey;
    const own = await mesh.view.get(DEVICES, { id: deviceId });
    if (!own || own.memberId || (await sharedKind(mesh.view))) {
        return;
    }
    const member = await mesh.view.get(MEMBERS, { id: known.id });
    if (!member) {
        return;
    }
    const attestation = claimAttestation(mesh.publicKey, deviceId, mesh.localWriterKey);
    const proof = await attestMemberClaim(attestation, deviceKeyPair, known.proof);
    await mesh.dispatch('join-member', { member, proof });
    await mesh.refreshOurMember();
    log?.info('membership', 'claimed our own member in a mesh a sibling device joined');
}
export function namedAt(identity) {
    return identity.displayNameAt || 0;
}
export async function legacyNameStamp(account, { deviceKeyPair }, identity) {
    const own = await account.view.get(DEVICES, { id: deviceKeyPair.publicKey });
    if (!own?.memberId) {
        return null;
    }
    const member = await account.view.get(MEMBERS, { id: own.memberId });
    return member && member.name === identity.displayName ? member.updatedAt : null;
}
export async function renameFoundedMember(mesh, { deviceKeyPair, log }, { identity, adopt }) {
    if (!identity.displayName)
        return;
    const own = await mesh.view.get(DEVICES, { id: deviceKeyPair.publicKey });
    if (!own?.memberId || !own.memberProof) {
        return;
    }
    const member = await mesh.view.get(MEMBERS, { id: own.memberId });
    if (!member || member.name === identity.displayName) {
        return;
    }
    if (namedAt(identity) < member.updatedAt) {
        await adopt(member.name, member.updatedAt);
        log?.info('membership', 'another device of this member renamed it later, so this one follows');
        return;
    }
    await mesh.dispatch('update-member', {
        member: { ...member, name: identity.displayName, updatedAt: namedAt(identity) }
    });
    log?.info('membership', 'the member this device founded carries its user name');
}
