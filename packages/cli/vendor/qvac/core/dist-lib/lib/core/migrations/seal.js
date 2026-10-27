import { claimableDevice } from '../mesh.js';
import { sealed } from '../contract/seal.js';
import { DEVICES } from '../collections.js';
export async function sealDeviceRows(mesh, { deviceKeyPair, deviceName, log }) {
    if (!mesh.writable)
        return false;
    const own = await mesh.view.get(DEVICES, { id: deviceKeyPair.publicKey });
    if (!own || (await sealed(mesh.view))) {
        return false;
    }
    const joinedAt = Date.now();
    const { id, capabilityProfile, recommendedModelName } = own;
    await mesh.dispatch('add-writer', {
        writerKey: mesh.localWriterKey,
        device: claimableDevice({
            id,
            joinedAt,
            name: deviceName,
            capabilityProfile,
            recommendedModelName
        }),
        deviceSignature: mesh.signDeviceClaim(deviceKeyPair.secretKey, id, joinedAt)
    });
    const after = await mesh.view.get(DEVICES, { id });
    if (!after?.deviceSignature) {
        log?.warn(['p2p', 'mesh'], 'the re-admission that should have sealed this mesh was refused');
        return false;
    }
    log?.info(['p2p', 'mesh'], 'migrated: sealed the device rows this mesh predates');
    return true;
}
