import { scopeKey } from './scope-key.js';
function setupFields(entry) {
    return (entry.setup?.routes ?? []).flatMap((route) => route.fields ?? []);
}
export function requiredSettings(entry) {
    return [
        ...new Set(setupFields(entry)
            .filter((field) => field.required === true && field.secret !== true)
            .map((field) => field.key))
    ];
}
export function isSettingField(field) {
    return field.secret !== true;
}
export function settingEnvName(skill, key) {
    return `QVAC_SKILL_${envToken(skill)}_${settingKeyToken(key)}`;
}
function envToken(value) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}
function settingKeyToken(value) {
    return value
        .toUpperCase()
        .replace(/-/g, '_H_')
        .replace(/[^A-Z0-9_]/g, '_');
}
export function settingsEnv(skill, settings) {
    const env = {};
    for (const [key, value] of Object.entries(settings)) {
        env[settingEnvName(skill, key)] = value;
    }
    return env;
}
export function settingsScopeKey(skill, agentId) {
    return scopeKey({ agentId, skill, key: '' });
}
