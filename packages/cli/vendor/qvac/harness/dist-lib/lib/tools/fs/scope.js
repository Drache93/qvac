import fs from 'fs';
import path from 'path';
import process from 'process';
import { HarnessError } from '../../errors.js';
import { SPILL_DIR } from '../../spill.js';
export const defaultRealpath = (p) => fs.promises.realpath(p);
export const NO_DIRS_GRANTED = 'no directories are granted';
const HYPER_PREFIX = 'hyper://';
function rootLabel(root) {
    return root.kind === 'local' ? root.root : `${HYPER_PREFIX}${root.key}`;
}
function outside(roots) {
    return { error: `path must be inside one of: ${roots.map(rootLabel).join(', ')}` };
}
export function deniedRootsFor(sdkHome) {
    if (!sdkHome)
        throw new HarnessError('NO_STORAGE_ROOT');
    return [path.dirname(sdkHome), SPILL_DIR];
}
export const PROTECTED_PATH_ERROR = 'path is inside a protected app directory';
function protectedPath() {
    return { error: PROTECTED_PATH_ERROR };
}
export async function canonicalDenyRoots(deniedRoots, realpath) {
    if (!deniedRoots?.length)
        return [];
    return Promise.all(deniedRoots.map(async (raw) => {
        const resolved = path.resolve(raw);
        try {
            return await realpath(resolved);
        }
        catch {
            return realpath(path.dirname(resolved)).then((parent) => path.join(parent, path.basename(resolved)), () => resolved);
        }
    }));
}
export function callDenyRoots(deniedRoots, policy, realpath) {
    return canonicalDenyRoots([...(deniedRoots ?? []), ...(policy?.files.deny ?? [])], realpath);
}
export function isDeniedPath(hostPath, canonicalDenyRoots) {
    return canonicalDenyRoots.some((root) => contained(hostPath, root, { ignoreCase: true }));
}
const FOLD_CASE = process.platform === 'darwin' || process.platform === 'win32';
function within(candidate, root) {
    return contained(candidate, root, { ignoreCase: FOLD_CASE });
}
export function overlaps(a, b) {
    return within(a, b) || within(b, a);
}
function contained(candidate, root, { ignoreCase }) {
    const a = ignoreCase ? candidate.toLowerCase() : candidate;
    const b = ignoreCase ? root.toLowerCase() : root;
    return a === b || a.startsWith(b + path.sep);
}
function withinPrefix(candidate, prefix) {
    if (prefix === '/')
        return true;
    return candidate === prefix || candidate.startsWith(prefix + '/');
}
function toKey(root, canonical) {
    const rel = path.relative(root.root, canonical);
    return rel ? `/${rel.split(path.sep).join('/')}` : '/';
}
export function hostPath(root, key) {
    return path.join(root.root, ...key.split('/').filter(Boolean));
}
export function displayPath(root, key) {
    return root.kind === 'local' ? hostPath(root, key) : `${HYPER_PREFIX}${root.key}${key}`;
}
const CONTROL_OR_NUL = /[\x00-\x1f]/;
const WINDOWS_DRIVE_LETTER = /^[A-Za-z]:/;
export function normalizeDriveKey(prefix, input) {
    if (input.includes('\\'))
        return null;
    if (WINDOWS_DRIVE_LETTER.test(input))
        return null;
    if (CONTROL_OR_NUL.test(input)) {
        return null;
    }
    if (input.includes('://')) {
        return null;
    }
    const segments = [];
    for (const segment of input.split('/')) {
        if (segment === '' || segment === '.')
            continue;
        if (segment === '..') {
            if (segments.length === 0) {
                return null;
            }
            segments.pop();
            continue;
        }
        segments.push(segment);
    }
    const normalized = segments.length ? `/${segments.join('/')}` : '/';
    return withinPrefix(normalized, prefix) ? normalized : null;
}
function matchHyperRoot(rest, roots) {
    return roots.find((r) => rest === r.key || rest.startsWith(r.key + '/'));
}
export async function resolveKey(p, roots, { realpath, deny = [] }) {
    if (roots.length === 0) {
        return { error: NO_DIRS_GRANTED };
    }
    if (p.startsWith(HYPER_PREFIX)) {
        const rest = p.slice(HYPER_PREFIX.length);
        const hyperRoots = roots.filter((r) => r.kind === 'hyper');
        const root = matchHyperRoot(rest, hyperRoots);
        if (!root) {
            return outside(roots);
        }
        const tail = rest.slice(root.key.length);
        const key = normalizeDriveKey(root.prefix, tail || '/');
        if (key === null) {
            return outside(roots);
        }
        return { root, key, exists: true };
    }
    const localRoots = roots.filter((r) => r.kind === 'local');
    let ancestor = path.resolve(p);
    const tail = [];
    while (true) {
        try {
            const canonical = await realpath(ancestor);
            const target = tail.length ? path.join(canonical, ...tail) : canonical;
            const root = localRoots.find((r) => within(target, r.root));
            if (!root) {
                return outside(roots);
            }
            if (isDeniedPath(target, deny)) {
                return protectedPath();
            }
            return { root, key: toKey(root, target), exists: tail.length === 0 };
        }
        catch {
            const parent = path.dirname(ancestor);
            if (parent === ancestor) {
                break;
            }
            tail.unshift(path.basename(ancestor));
            ancestor = parent;
        }
    }
    return outside(roots);
}
