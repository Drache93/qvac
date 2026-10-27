import { credentialRecord, isCredentialExpired } from './auth-resolver.js';
import { Agent } from '../../agent/index.js';
import { missingBins } from './bin-check.js';
import { credentialSlots } from './credential-slots.js';
import { requiredSettings } from './skill-settings.js';
import { isCredentialRejected } from './credential-health.js';
import { isCapabilityProfile, meetsMinCapabilityProfile } from '../../models/model-catalog.js';
import { SKILL_STATE, isAvailableState } from './skill-state-constants.js';
export { SKILL_STATE, isAvailableState };
export function isStub(entry) {
    return entry.stub === true;
}
export function isToolSupported(entry, installedTools) {
    return entry.tools.every((name) => installedTools.has(Agent.parseToolGrant(name).name));
}
export function supportsPlatform(entry, platform) {
    return !platform || entry.platform.includes(platform);
}
export function isModelCompatible(entry, activeProfile) {
    const required = entry.minCapabilityProfile;
    if (!required || activeProfile === undefined || !isCapabilityProfile(required)) {
        return true;
    }
    return meetsMinCapabilityProfile(activeProfile, required);
}
function slotHealth(slot, { records, isRejected }) {
    let bad = false;
    for (const key of slot) {
        const record = records.get(key);
        const expired = !!record && isCredentialExpired(record);
        if (record && !isRejected(key) && !expired) {
            return 'healthy';
        }
        if (isRejected(key) || expired) {
            bad = true;
        }
    }
    return bad ? 'bad' : 'missing';
}
export async function resolveSkillState(entry, inputs = {}) {
    try {
        if (!supportsPlatform(entry, inputs.platform)) {
            return SKILL_STATE.unsupported;
        }
        if (isStub(entry)) {
            return SKILL_STATE.disabled;
        }
        if (!isModelCompatible(entry, inputs.activeProfile)) {
            return SKILL_STATE.incompatibleModel;
        }
        const bins = entry.requires?.bins ?? [];
        const missing = bins.length > 0 ? missingBins(bins, inputs.platform, inputs.binOnPath) : [];
        const settled = await inputs.readiness?.state({
            platform: inputs.platform,
            agentId: inputs.agentId,
            credentialStore: inputs.credentialStore,
            missingBins: missing
        });
        if (settled) {
            return settled;
        }
        if (missing.length > 0) {
            return SKILL_STATE.needsSetup;
        }
        if (inputs.binVersions &&
            Object.keys(entry.requires?.binMinVersions ?? {}).some((bin) => inputs.binVersions?.get(bin) === 'too-old')) {
            return SKILL_STATE.outdated;
        }
        const required = requiredSettings(entry);
        if (required.length > 0) {
            const settings = inputs.settingsStore
                ? await inputs.settingsStore(entry.name, inputs.agentId)
                : {};
            if (required.some((key) => !settings[key])) {
                return SKILL_STATE.needsSetup;
            }
        }
        const slots = credentialSlots(entry);
        if (slots.length === 0) {
            return SKILL_STATE.ready;
        }
        const { rejected } = inputs;
        const isRejected = rejected
            ? (key) => rejected.has(key)
            : (key) => isCredentialRejected(key, inputs.agentId, entry.name);
        const store = inputs.credentialStore;
        if (!store) {
            return SKILL_STATE.needsSetup;
        }
        const records = new Map(await Promise.all([...new Set(slots.flat())].map(async (key) => [
            key,
            credentialRecord(await store(key, { agentId: inputs.agentId, skills: [entry.name] }))
        ])));
        let disconnected = false;
        let needsSetup = false;
        for (const slot of slots) {
            const health = slotHealth(slot, { records, isRejected });
            if (health === 'healthy') {
                continue;
            }
            if (health === 'bad') {
                disconnected = true;
            }
            else {
                needsSetup = true;
            }
        }
        if (disconnected) {
            return SKILL_STATE.disconnected;
        }
        if (needsSetup) {
            return SKILL_STATE.needsSetup;
        }
        return SKILL_STATE.ready;
    }
    catch {
        return SKILL_STATE.failed;
    }
}
