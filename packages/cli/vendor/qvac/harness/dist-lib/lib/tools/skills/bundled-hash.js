import crypto from 'crypto';
export function hashBundledSkills(files) {
    const hash = crypto.createHash('sha256');
    const sorted = [...files].sort(byPath);
    for (const file of sorted) {
        hash.update(file.path);
        hash.update('\0');
        hash.update(file.content);
        hash.update('\0');
    }
    return hash.digest('hex').slice(0, 16);
}
function byPath(a, b) {
    if (a.path < b.path)
        return -1;
    return a.path > b.path ? 1 : 0;
}
