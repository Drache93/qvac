export function fsGrantKey(agentId) {
    return `fs.${agentId}.roots`;
}
export function fsWriteGrantKey(agentId) {
    return `fs.${agentId}.writable`;
}
