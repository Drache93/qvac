import { capDeviceName } from '../../../schema/qvac.js';
import { backfillLiveDevices, trackActivity } from './activity.js';
import { sealed } from './seal.js';
import { verifyWriterClaim } from '../device-attestation.js';
import b4a from 'b4a';
import { DEVICES } from '../collections.js';
export function registerDeviceRoutes(router) {
    router.add('@qvac/register-device', trackActivity(async ({ device }, { tx, node, meshPublicKey, log }) => {
        const existing = await tx.get(DEVICES, { id: device.id });
        if (existing) {
            log?.debug('contract', 'register-device dropped: device already registered');
            return;
        }
        const signed = verifyWriterClaim(device.deviceSignature, {
            meshPublicKey,
            deviceId: device.id,
            writerKey: node.key,
            joinedAt: device.joinedAt
        });
        if (!signed && (await sealed(tx))) {
            log?.warn('contract', 'register-device dropped: the device did not sign for this writer');
            return;
        }
        const registered = {
            id: device.id,
            name: capDeviceName(device.name),
            joinedAt: device.joinedAt,
            capabilityProfile: device.capabilityProfile,
            recommendedModelName: device.recommendedModelName,
            revoked: device.revoked,
            revokedAt: device.revokedAt,
            writerKey: node.key,
            installedToolNames: device.installedToolNames,
            installedSkillNames: device.installedSkillNames,
            installedModelNames: device.installedModelNames,
            cachedModelNames: device.cachedModelNames,
            revokedBy: device.revokedBy,
            appVersion: device.appVersion,
            appBuild: device.appBuild,
            appChannel: device.appChannel,
            platform: device.platform,
            readySkillNames: device.readySkillNames,
            deviceSignature: signed ? device.deviceSignature : undefined
        };
        await tx.insert(DEVICES, registered);
        return registered;
    }));
    router.add('@qvac/update-device', trackActivity(async ({ device }, { tx, node, log }) => {
        const existing = await tx.get(DEVICES, { id: device.id });
        if (!existing) {
            log?.debug('contract', 'update-device dropped: unknown device');
            return;
        }
        if (!existing.writerKey || !b4a.equals(existing.writerKey, node.key)) {
            log?.warn('contract', 'update-device dropped: writer is not the device owner', {
                id: device.id
            });
            return;
        }
        const next = { ...existing, name: capDeviceName(device.name) };
        await tx.insert(DEVICES, next);
        return next;
    }));
    router.add('@qvac/update-device-profile', trackActivity(async ({ deviceId, capabilityProfile, recommendedModelName, platform }, { tx, node, log }) => {
        const existing = await tx.get(DEVICES, { id: deviceId });
        if (!existing) {
            log?.debug('contract', 'update-device-profile dropped: unknown device');
            return;
        }
        if (!existing.writerKey || !b4a.equals(existing.writerKey, node.key)) {
            log?.warn('contract', 'update-device-profile dropped: writer is not the device owner', {
                id: deviceId
            });
            return;
        }
        const next = {
            ...existing,
            capabilityProfile,
            recommendedModelName,
            platform: platform ?? existing.platform
        };
        await tx.insert(DEVICES, next);
        return next;
    }));
    router.add('@qvac/report-device-capabilities', trackActivity(async ({ deviceId, installedToolNames, installedSkillNames, installedModelNames, cachedModelNames, readySkillNames, toolCatalog }, { tx, node, log }) => {
        const existing = await tx.get(DEVICES, { id: deviceId });
        if (!existing) {
            log?.debug('contract', 'report-device-capabilities dropped: unknown device');
            return;
        }
        if (!existing.writerKey || !b4a.equals(existing.writerKey, node.key)) {
            log?.warn('contract', 'report-device-capabilities dropped: writer is not the device owner', {
                id: deviceId
            });
            return;
        }
        const next = {
            ...existing,
            installedToolNames: installedToolNames ?? [],
            installedSkillNames: installedSkillNames ?? [],
            installedModelNames: installedModelNames ?? [],
            cachedModelNames: cachedModelNames ?? [],
            readySkillNames: readySkillNames ?? existing.readySkillNames,
            toolCatalog: toolCatalog ?? existing.toolCatalog
        };
        await tx.insert(DEVICES, next);
        return next;
    }));
    router.add('@qvac/report-device-version', trackActivity(async ({ deviceId, appVersion, appBuild, appChannel }, { tx, node, log }) => {
        const existing = await tx.get(DEVICES, { id: deviceId });
        if (!existing) {
            log?.debug('contract', 'report-device-version dropped: unknown device');
            return;
        }
        if (!existing.writerKey || !b4a.equals(existing.writerKey, node.key)) {
            log?.warn('contract', 'report-device-version dropped: writer is not the device owner', {
                id: deviceId
            });
            return;
        }
        const next = { ...existing, appVersion, appBuild, appChannel };
        await tx.insert(DEVICES, next);
        return next;
    }));
    router.add('@qvac/reindex-devices', async (_op, { tx }) => {
        await backfillLiveDevices(tx);
    });
}
