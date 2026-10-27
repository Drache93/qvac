import fs from 'fs';
import path from 'path';
import { callDenyRoots, hostPath, resolveKey } from './scope.js';
const HYPER_PREFIX = 'hyper://';
export function anchorOf(grants) {
    return grants?.fsRoots?.[0] ?? grants?.fsWriteRoots?.[0];
}
function baseOf(root) {
    return root.kind === 'local' ? root.root : `${HYPER_PREFIX}${root.key}`;
}
export function rootedPath(p, anchor) {
    if (!anchor || p.startsWith(HYPER_PREFIX) || path.isAbsolute(p) || p.startsWith('~')) {
        return p;
    }
    if (anchor.kind === 'local') {
        return path.join(anchor.root, p);
    }
    const prefix = anchor.prefix === '/' ? '' : anchor.prefix;
    return `${HYPER_PREFIX}${anchor.key}${prefix}/${p.replace(/^\.?\//, '')}`;
}
export function shownPath(full, anchor) {
    if (!anchor) {
        return full;
    }
    const base = baseOf(anchor);
    if (full === base) {
        return '.';
    }
    return full.startsWith(base + '/') ? full.slice(base.length + 1) : full;
}
export async function resolveRooted(p, { grants, write, realpath, deniedRoots }) {
    const roots = (write ? grants?.fsWriteRoots : grants?.fsRoots) ?? [];
    const deny = await callDenyRoots(deniedRoots, grants?.policy, realpath);
    return resolveKey(rootedPath(p, anchorOf(grants)), roots, { realpath, deny });
}
export function rootedArgs(args, grants, keys) {
    const anchor = anchorOf(grants);
    const paths = [];
    for (const key of keys) {
        const value = stringArg(args, key);
        if (value === null) {
            return null;
        }
        paths.push(rootedPath(value, anchor));
    }
    return paths;
}
export function stringArg(args, key) {
    const value = args[key];
    return typeof value === 'string' && value.trim() ? value : null;
}
export function positiveInt(value) {
    const n = Number(value);
    return value === undefined || value === null || !Number.isInteger(n) || n < 1 ? undefined : n;
}
export function existsNow(p, grants) {
    const anchor = anchorOf(grants);
    if (!p || !anchor || anchor.kind !== 'local') {
        return true;
    }
    const target = rootedPath(p, anchor);
    return !path.isAbsolute(target) || fs.existsSync(target);
}
export function rootedLabel(verb, { grants, paths }) {
    const anchor = anchorOf(grants);
    return `${verb} ${paths.map((p) => rootedPath(p, anchor)).join(' → ')}`;
}
export function localPathOf(resolved) {
    return resolved.root.kind === 'local' ? hostPath(resolved.root, resolved.key) : null;
}
