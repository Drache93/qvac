import { readinessForAgents } from '../skill-readiness.js';
import { listAgents } from './agent.js';
import { DEVICES } from './collections.js';
export async function saveDeviceCapabilities(store, input, isAccount) {
    const report = isAccount(store) ? input : await hostedOnly(store, input);
    await store.dispatch('report-device-capabilities', report);
}
export async function retractInventory(store, deviceId, isAccount) {
    if (isAccount(store))
        return;
    const snap = store.view.snapshot();
    let row;
    try {
        row = await snap.get(DEVICES, { id: deviceId });
    }
    finally {
        await snap.close();
    }
    if (!row) {
        return;
    }
    const trimmed = await hostedOnly(store, {
        deviceId,
        installedToolNames: [],
        installedSkillNames: [],
        installedModelNames: [],
        cachedModelNames: [],
        readySkillNames: row.readySkillNames
    });
    const leaked = [
        row.installedToolNames,
        row.installedSkillNames,
        row.installedModelNames,
        row.cachedModelNames,
        row.toolCatalog
    ].some((list) => list?.length) ||
        (row.readySkillNames?.length ?? 0) > (trimmed.readySkillNames?.length ?? 0);
    if (leaked) {
        await store.dispatch('report-device-capabilities', trimmed);
    }
}
async function hostedOnly(store, input) {
    const hosted = new Set((await listAgents(store, input.deviceId)).map((agent) => agent.id));
    return {
        deviceId: input.deviceId,
        installedToolNames: [],
        installedSkillNames: [],
        installedModelNames: [],
        cachedModelNames: [],
        readySkillNames: readinessForAgents(input.readySkillNames ?? [], hosted),
        toolCatalog: []
    };
}
export async function advertiseDeviceVersion(store, deviceId, app) {
    await store.dispatch('report-device-version', {
        deviceId,
        appVersion: app.version,
        appBuild: app.build,
        appChannel: app.channel
    });
}
