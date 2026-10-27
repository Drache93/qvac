import crypto from 'crypto';
export function promptPrefixHash({ system, tools }) {
    const hash = crypto.createHash('sha256');
    hash.update(system ?? '');
    for (const tool of tools ?? []) {
        hash.update('\0');
        hash.update(JSON.stringify(tool));
    }
    return hash.digest('hex').slice(0, 12);
}
