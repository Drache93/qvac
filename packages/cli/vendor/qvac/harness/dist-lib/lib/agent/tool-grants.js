const GRANT_RE = /^([\w-]+)\((.*)\)$/;
export function parseToolGrant(entry) {
    const trimmed = entry.trim();
    const match = GRANT_RE.exec(trimmed);
    if (!match) {
        return { name: trimmed, scope: null };
    }
    const name = match[1] ?? '';
    const scope = (match[2] ?? '').trim();
    if (!name) {
        return { name: trimmed, scope: null };
    }
    if (!scope) {
        return { name, scope: null };
    }
    return { name, scope };
}
