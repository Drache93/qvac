import { parseToolGrant } from './tool-grants.js';
import { SKILL_TOOL_NAME, WEB_SEARCH_TOOL_NAME } from './tool-names.js';
export function collectToolGrants(skills) {
    const grants = {
        grantedNames: new Set(),
        grantedOwners: new Map(),
        grantedOps: new Map()
    };
    for (const skill of skills) {
        for (const entry of skill.tools) {
            const { name, scope } = parseToolGrant(entry);
            grants.grantedNames.add(name);
            const owners = grants.grantedOwners.get(name) ?? new Set();
            owners.add(skill.name);
            grants.grantedOwners.set(name, owners);
            if (scope && skill.cliValidator && skill.cliValidator.bin === scope.toLowerCase()) {
                const list = grants.grantedOps.get(scope.toLowerCase()) ?? [];
                list.push(skill.cliValidator);
                grants.grantedOps.set(scope.toLowerCase(), list);
            }
        }
    }
    return grants;
}
export function skillsAreSelected(scope, hasAgent) {
    return hasAgent && scope !== 'all';
}
export function skillIsActive(name, { skillsSelected, enabledSkills }) {
    return !skillsSelected || enabledSkills.includes(name);
}
export function isSelected(scope, list) {
    return (scope ?? (list?.length ? 'selected' : 'all')) === 'selected';
}
export function enabledTools(tools, { toolsSelected, allowlist, grantedNames, grantedOwners, loadedGrantedNames, hasRoots, hasWriteRoots, hasActiveSkills, capabilityProfile }) {
    return tools.filter((tool) => {
        if (tool.name === SKILL_TOOL_NAME)
            return hasActiveSkills;
        if (tool.owningSkill !== undefined) {
            return grantedOwners.get(tool.name)?.has(tool.owningSkill) === true;
        }
        if (tool.name === WEB_SEARCH_TOOL_NAME &&
            toolsSelected &&
            !allowlist.includes(WEB_SEARCH_TOOL_NAME)) {
            return false;
        }
        if (tool.rootsRequired)
            return hasRoots;
        if (tool.writeRootsRequired) {
            return hasWriteRoots;
        }
        if (tool.skillGated) {
            const early = capabilityProfile !== undefined && tool.ungatedFor?.includes(capabilityProfile);
            return loadedGrantedNames.has(tool.name) || (early === true && grantedNames.has(tool.name));
        }
        if (!toolsSelected) {
            return true;
        }
        return allowlist.includes(tool.name) || grantedNames.has(tool.name);
    });
}
export const NETWORK_TOOLSETS = ['web-search', 'http-request', 'mcp-call'];
export function permittedTools(tools, disabled) {
    if (!disabled?.length) {
        return [...tools];
    }
    const off = new Set(disabled);
    return tools.filter((tool) => !tool.toolset || !off.has(tool.toolset));
}
