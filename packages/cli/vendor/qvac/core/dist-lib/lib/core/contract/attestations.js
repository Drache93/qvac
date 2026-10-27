import { verifyDeviceAttestation } from '../device-attestation.js';
import { DEVICE_ATTESTATIONS } from '../collections.js';
export function registerAttestationRoutes(router) {
    router.add('@qvac/attest-device', async (payload, { tx, meshDevicePublicKey, log }) => {
        if (!verifyDeviceAttestation(meshDevicePublicKey, payload)) {
            log?.warn('contract', 'attest-device dropped: signature is not over this device id');
            return;
        }
        await tx.insert(DEVICE_ATTESTATIONS, {
            deviceId: payload.deviceId,
            signature: payload.signature
        });
    });
}
