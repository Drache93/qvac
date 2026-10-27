import crypto from 'hypercore-crypto';
import { trackActivity } from './activity.js';
import { linkMember, outsideAccount, provenMember } from './members.js';
import { outsideProject } from './projects.js';
import { admitAdmin, isWorkspace } from './workspace.js';
import { admitDevice } from './writers.js';
import b4a from 'b4a';
import { DEVICES } from '../collections.js';
export function registerOpenJoinRoutes(router) {
    router.add('@qvac/open-join', trackActivity(async (payload, context) => {
        const { tx, node, host, meshPublicKey, log } = context;
        let valid = false;
        try {
            valid = crypto.verify(node.key, payload.signature, meshPublicKey);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            log?.warn('contract', 'open-join dropped: invalid writer-claim signature');
            return;
        }
        const id = payload.deviceId;
        if (!id) {
            return;
        }
        const claimed = await claimedMember(payload, context, id);
        if (await outsideAccount(tx, claimed?.member.id)) {
            log?.warn('contract', "open-join dropped: no claim reaching the account's member");
            return;
        }
        if (await outsideProject(tx, claimed?.member.id)) {
            log?.warn('contract', "open-join dropped: no claim for a member on the project's list");
            return;
        }
        const admission = await admitDevice(context, payload.device, {
            id,
            writerKey: node.key,
            claim: { deviceSignature: payload.deviceSignature }
        });
        if (admission !== 'admitted') {
            return;
        }
        await host.addWriter(node.key);
        if (claimed) {
            await linkClaimed(tx, id, claimed);
        }
        return payload.device;
    }));
}
async function linkClaimed(tx, id, claimed) {
    const admitted = await tx.get(DEVICES, { id });
    if (!admitted) {
        return;
    }
    await linkMember(tx, admitted, claimed);
    if (await isWorkspace(tx)) {
        await admitAdmin(tx, claimed.member.id);
    }
}
async function claimedMember({ member, memberClaim }, { node, meshPublicKey, log }, deviceId) {
    if (!member || !memberClaim)
        return null;
    const proof = await provenMember(meshPublicKey, {
        deviceId,
        writerKey: node.key,
        memberId: member.id,
        claim: memberClaim
    });
    if (!proof) {
        log?.warn('contract', 'open-join: the member claim does not bind this writer', {
            device: b4a.toHex(deviceId).slice(0, 16)
        });
        return null;
    }
    return { member, proof };
}
