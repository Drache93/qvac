export const SKILL_STATE = {
    ready: 'ready',
    needsSetup: 'needs-setup',
    disconnected: 'disconnected',
    unsupported: 'unsupported',
    disabled: 'disabled',
    outdated: 'outdated',
    incompatibleModel: 'incompatible-model',
    failed: 'failed'
};
const AVAILABLE_STATES = new Set([SKILL_STATE.ready]);
export function isAvailableState(state) {
    return AVAILABLE_STATES.has(state);
}
const DEVICE_SHARED_CREDENTIAL_KEYS = new Set(['obsidian_vault_path']);
export function isDeviceSharedCredentialKey(key) {
    return DEVICE_SHARED_CREDENTIAL_KEYS.has(key);
}
