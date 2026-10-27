import { NO_DIRS_GRANTED, resolveKey } from './scope.js';
export async function searchTargets(dir, roots, { realpath, deny }) {
    if (typeof dir === 'string' && dir.trim()) {
        const resolved = await resolveKey(dir, roots, { realpath, deny });
        if ('error' in resolved) {
            return resolved;
        }
        if (resolved.root.kind === 'local') {
            if (!resolved.exists) {
                return { error: `no such file: ${dir}` };
            }
        }
        else {
            let hasEntry = false;
            for await (const _entry of resolved.root.drive.list(resolved.key)) {
                hasEntry = true;
                break;
            }
            if (!hasEntry && (await resolved.root.drive.entry(resolved.key)) === null) {
                return { error: `no such file: ${dir}` };
            }
        }
        return { targets: [{ root: resolved.root, folder: resolved.key }] };
    }
    if (roots.length === 0) {
        return { error: NO_DIRS_GRANTED };
    }
    return { targets: roots.map((root) => ({ root, folder: '/' })) };
}
export function relativeKey(key, folder) {
    return folder === '/' ? key.slice(1) : key.slice(folder.length + 1);
}
