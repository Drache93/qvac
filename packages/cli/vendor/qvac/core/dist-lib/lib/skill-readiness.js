const AGENT_PREFIX = '\0agent-skill-readiness\0';
function prefix(agentId) {
    return `${AGENT_PREFIX}${agentId}\0`;
}
export function encodeAgentSkillReadiness(agentId, readySkillNames) {
    const scoped = prefix(agentId);
    return [scoped, ...readySkillNames.map((name) => `${scoped}${name}`)];
}
export function agentReadySkillNames(reported, agentId) {
    if (reported === null || reported === undefined)
        return null;
    const unscoped = reported.filter((name) => !name.startsWith(AGENT_PREFIX));
    if (!agentId || !reported.some((name) => name.startsWith(AGENT_PREFIX))) {
        return unscoped;
    }
    const scoped = prefix(agentId);
    if (!reported.includes(scoped)) {
        return unscoped;
    }
    return reported
        .filter((name) => name !== scoped && name.startsWith(scoped))
        .map((name) => name.slice(scoped.length));
}
function scopedAgentId(name) {
    if (!name.startsWith(AGENT_PREFIX))
        return null;
    const end = name.indexOf('\0', AGENT_PREFIX.length);
    return end === -1 ? null : name.slice(AGENT_PREFIX.length, end);
}
export function readinessForAgents(reported, agentIds) {
    const marked = new Set([...agentIds].filter((id) => reported.includes(prefix(id))));
    return reported.filter((name) => {
        const agentId = scopedAgentId(name);
        return agentId !== null && marked.has(agentId);
    });
}
