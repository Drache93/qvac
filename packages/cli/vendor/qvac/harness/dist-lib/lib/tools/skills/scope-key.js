export function scopeKey({ agentId, skill, key }) {
    return `${agentId ?? ''}\0${skill ?? ''}\0${key}`;
}
export function deviceSharedKeys(readiness) {
    return new Set([...readiness].flatMap((entry) => entry.deviceSharedKeys ?? []));
}
