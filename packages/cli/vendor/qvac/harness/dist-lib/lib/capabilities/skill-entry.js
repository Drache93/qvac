import { SKILL_STATE, isAvailableState } from '../tools/skills/skill-state-constants.js';
export function skillInContext(entry) {
    return entry.status === undefined || isAvailableState(entry.status);
}
export function unreadySkillState(name, catalog) {
    const status = catalog.find((entry) => entry.name === name)?.status;
    return status !== undefined && !isAvailableState(status) ? status : null;
}
export function unreadySkillMessage(name, state) {
    if (state === SKILL_STATE.incompatibleModel) {
        return `skill "${name}" needs a larger model than the one loaded. Tell the user to pick a larger model to use it; do not retry.`;
    }
    return `skill "${name}" is ${state} and cannot be used yet. Tell the user to open it in Skills and finish its setup; do not retry.`;
}
