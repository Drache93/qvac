import { collectToolGrants, enabledTools } from './tool-selection.js';
export function selectEnabledTools(inputs) {
    if (inputs.responseFormat)
        return [];
    const loaded = inputs.activeSkills.filter((skill) => inputs.loadedSkills.has(skill.name));
    return enabledTools(inputs.tools, {
        toolsSelected: inputs.toolsSelected,
        allowlist: inputs.allowlist,
        grantedNames: inputs.grantedNames,
        grantedOwners: inputs.grantedOwners,
        loadedGrantedNames: collectToolGrants(loaded).grantedNames,
        hasRoots: inputs.hasRoots,
        hasWriteRoots: inputs.hasWriteRoots,
        hasActiveSkills: inputs.activeSkills.length > 0,
        capabilityProfile: inputs.capabilityProfile
    });
}
