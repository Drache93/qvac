export function missingPeers(peers) {
    return Object.keys(peers).filter((name) => !resolves(peers[name]));
}
export function requirePeers(subject, peers) {
    const missing = missingPeers(peers);
    if (missing.length === 0) {
        return;
    }
    throw new Error(`${subject} needs ${missing.join(', ')}, not installed (optional peers of @qvac/harness): npm install ${missing.join(' ')}`);
}
function resolves(resolve) {
    try {
        resolve?.();
        return true;
    }
    catch (error) {
        const code = Reflect.get(Object(error), 'code');
        if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
            return false;
        }
        throw error;
    }
}
