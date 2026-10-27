import { MAX_DEVICE_NAME_CHARS, deviceNameWithinBounds } from '../../schema/qvac.js';
import { saveDeviceCapabilities } from '../core/devices.js';
import { adminsLastDevice } from '../core/contract/workspace.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { requireOurAdmin } from './members.js';
import b4a from 'b4a';
import { DEVICES } from '../core/collections.js';
import { CoreError } from '../errors.js';
function toEngineDevice(device, overrides = {}) {
    return {
        id: device.id,
        name: device.name,
        joinedAt: device.joinedAt,
        revoked: device.revoked ?? false,
        installedToolNames: device.installedToolNames ?? [],
        installedSkillNames: device.installedSkillNames ?? [],
        readySkillNames: device.readySkillNames,
        toolCatalog: device.toolCatalog,
        installedModelNames: device.installedModelNames ?? [],
        cachedModelNames: device.cachedModelNames ?? [],
        capabilityProfile: device.capabilityProfile,
        recommendedModelName: device.recommendedModelName,
        appVersion: device.appVersion,
        appBuild: device.appBuild,
        appChannel: device.appChannel,
        platform: device.platform,
        memberId: device.memberId,
        ...overrides
    };
}
export function createDevicesApi(pool, { deviceId, log, removeWriter, renameLocal, saveProfileLocal, readLocalProfile, isAccount }) {
    const mustGetDevice = async (mesh, id) => {
        const snap = mesh.view.snapshot();
        try {
            const device = await snap.get(DEVICES, { id });
            if (!device) {
                throw new CoreError('DEVICE_NOT_FOUND', [b4a.toHex(id)]);
            }
            return device;
        }
        finally {
            await snap.close();
        }
    };
    const list = async (mesh) => {
        const snap = mesh.view.snapshot();
        try {
            const devices = await snap.find(DEVICES).toArray();
            return { devices: devices.map((device) => toEngineDevice(device)) };
        }
        finally {
            await snap.close();
        }
    };
    return {
        listDevices: async (request) => list(await requireMesh(pool, request.meshId)),
        getDevice: async ({ deviceId: id, meshId }) => toEngineDevice(await mustGetDevice(await requireMesh(pool, meshId), id)),
        devicesWatch: meshWatchable(pool, (_request, mesh) => list(mesh), { name: 'devicesWatch', log }),
        deviceInfo: async () => {
            log?.info(['api', 'devices'], 'deviceInfo handler reached');
            return { id: deviceId, supportsKvCacheDeletion: true };
        },
        saveDeviceCapabilities: async (input) => {
            await saveDeviceCapabilities(await requireMesh(pool, input.meshId), {
                deviceId,
                installedToolNames: input.installedToolNames ?? [],
                installedSkillNames: input.installedSkillNames ?? [],
                installedModelNames: input.installedModelNames ?? [],
                cachedModelNames: input.cachedModelNames ?? [],
                readySkillNames: input.readySkillNames ?? null,
                toolCatalog: input.toolCatalog ?? null
            }, isAccount);
            return { ok: true };
        },
        removeDevice: async ({ deviceId: target, meshId }) => {
            if (b4a.equals(target, deviceId)) {
                throw new CoreError('DEVICE_REMOVE_SELF');
            }
            const mesh = await requireMesh(pool, meshId);
            const device = await mustGetDevice(mesh, target);
            if (device.revoked) {
                return { ok: true };
            }
            if (!device.writerKey) {
                throw new CoreError('DEVICE_NO_WRITER_KEY');
            }
            const owner = device.memberId ?? device.claimedMemberId;
            const ours = mesh.ourMemberId;
            if (mesh.role === 'workspace' && !(owner && ours && b4a.equals(owner, ours))) {
                await requireOurAdmin(mesh, "remove another member's device");
                if (await adminsLastDevice(mesh.view, device)) {
                    throw new CoreError('DEVICE_ADMIN_LAST');
                }
            }
            await removeWriter(device.writerKey, target, mesh);
            return { ok: true };
        },
        renameDevice: async ({ meshId, config }) => {
            const trimmed = config.name.trim();
            if (!trimmed) {
                throw new CoreError('DEVICE_NAME_EMPTY');
            }
            if (!deviceNameWithinBounds(trimmed)) {
                throw new CoreError('DEVICE_NAME_TOO_LONG', [MAX_DEVICE_NAME_CHARS]);
            }
            const mesh = await requireMesh(pool, meshId);
            const device = await mustGetDevice(mesh, deviceId);
            await renameLocal(trimmed);
            try {
                await mesh.dispatch('update-device', { device: { ...device, name: trimmed } });
            }
            catch (err) {
                await renameLocal(device.name);
                throw err;
            }
            return toEngineDevice(device, { name: trimmed });
        },
        saveDeviceProfile: async ({ capabilityProfile, recommendedModelName, platform, meshId }) => {
            const mesh = await requireMesh(pool, meshId);
            const prior = readLocalProfile();
            await saveProfileLocal(capabilityProfile, recommendedModelName, platform ?? undefined);
            try {
                await mesh.dispatch('update-device-profile', {
                    deviceId,
                    capabilityProfile,
                    recommendedModelName,
                    platform
                });
            }
            catch (err) {
                if (prior) {
                    await saveProfileLocal(prior.capabilityProfile, prior.recommendedModelName, prior.platform);
                }
                throw err;
            }
            const device = await mustGetDevice(mesh, deviceId);
            return toEngineDevice(device, {
                capabilityProfile,
                recommendedModelName,
                platform: platform ?? device.platform
            });
        }
    };
}
