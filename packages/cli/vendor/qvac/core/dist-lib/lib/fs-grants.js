import path from 'path';
import HypercoreId from 'hypercore-id-encoding';
function parseHyperKey(value) {
    if (typeof value !== 'string')
        return null;
    try {
        HypercoreId.decode(value);
        return value;
    }
    catch {
        return null;
    }
}
export function fsGrantsFrom(value) {
    if (!Array.isArray(value))
        return [];
    const items = value;
    const grants = [];
    for (const item of items) {
        if (typeof item === 'string') {
            if (path.isAbsolute(item)) {
                grants.push({ kind: 'local', path: item });
            }
            continue;
        }
        if (!item || typeof item !== 'object') {
            continue;
        }
        const kind = 'kind' in item ? item.kind : undefined;
        if (kind === 'local') {
            const dir = 'path' in item ? item.path : undefined;
            if (typeof dir === 'string' && path.isAbsolute(dir)) {
                grants.push({ kind: 'local', path: dir });
            }
        }
        else if (kind === 'hyper') {
            const key = parseHyperKey('key' in item ? item.key : undefined);
            if (key) {
                grants.push({ kind: 'hyper', key });
            }
        }
    }
    return grants;
}
export function grantedDirsFrom(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((dir) => typeof dir === 'string' && path.isAbsolute(dir));
}
