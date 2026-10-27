import { attestDeviceProof } from '../identity.js';
import { membershipView } from '../membership.js';
import b4a from 'b4a';
export async function migrateMembership(mesh, { deviceKeyPair, deviceName, mintRoot, log }) {
    const { members, own, unattested } = await membershipView(mesh, deviceKeyPair.publicKey);
    if (!own) {
        return false;
    }
    const { memberId } = own;
    const resuming = !!memberId && members === 1 && unattested.length > 0;
    if (!resuming && (members > 0 || memberId)) {
        return false;
    }
    const now = Date.now();
    const root = await mintRoot(own.id, now);
    if (resuming && !b4a.equals(memberId, root.publicKey)) {
        return false;
    }
    if (!resuming) {
        await mesh.dispatch('mint-member', {
            member: { id: root.publicKey, name: deviceName, joinedAt: now, updatedAt: now },
            proof: root.proof
        });
        await mesh.refreshOurMember();
    }
    if (unattested.length > 0) {
        const batch = mesh.batch();
        for (const device of unattested) {
            batch.dispatch('attest-member-device', {
                deviceId: device.id,
                memberId: root.publicKey,
                proof: await attestDeviceProof(device.id, deviceKeyPair, root.proof),
                attestedAt: now
            });
        }
        await batch.flush();
    }
    log?.info(['p2p', 'mesh'], 'migrated: minted the member this mesh predates', {
        attested: unattested.length,
        resumed: resuming
    });
    return true;
}
