import { promises as fsp } from 'node:fs';
import path from 'node:path';
export async function readAddonPackageJson(options) {
    const { packageJsonPath, expectedName } = options;
    let raw;
    try {
        raw = await fsp.readFile(packageJsonPath, 'utf8');
    }
    catch {
        return { found: false, isAddon: false };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            found: true,
            isAddon: false,
            invalid: buildInvalid(packageJsonPath, expectedName, `malformed JSON: ${reason}`)
        };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {
            found: true,
            isAddon: false,
            invalid: buildInvalid(packageJsonPath, expectedName, 'package.json is not a JSON object')
        };
    }
    const pkg = parsed;
    const record = buildRecord(pkg, packageJsonPath, expectedName);
    if (pkg.addon !== true) {
        const result = { found: true, isAddon: false };
        if (record !== null)
            result.record = record;
        const splitAddon = buildSplitAddon(pkg, packageJsonPath);
        if (splitAddon !== null)
            result.splitAddon = splitAddon;
        return result;
    }
    const name = pkg.name ?? expectedName;
    if (!name) {
        return {
            found: true,
            isAddon: false,
            invalid: buildInvalid(packageJsonPath, expectedName, 'addon package.json is missing a `name` field')
        };
    }
    const addon = {
        name,
        packageJsonPath,
        packageRoot: path.dirname(packageJsonPath)
    };
    if (typeof pkg.version === 'string')
        addon.version = pkg.version;
    if (typeof pkg.engines?.bare === 'string')
        addon.enginesBare = pkg.engines.bare;
    return record === null
        ? { found: true, isAddon: true, addon }
        : { found: true, isAddon: true, addon, record };
}
function buildSplitAddon(pkg, packageJsonPath) {
    if (typeof pkg.name !== 'string')
        return null;
    const prefix = `${pkg.name}-`;
    const platformPackages = new Set();
    const visit = (value) => {
        if (typeof value === 'string') {
            if (value.startsWith(prefix))
                platformPackages.add(value);
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const child of Object.values(value))
                visit(child);
        }
    };
    visit(pkg.imports?.['#host-addon']);
    if (platformPackages.size === 0)
        return null;
    const addon = {
        name: pkg.name,
        packageJsonPath,
        packageRoot: path.dirname(packageJsonPath)
    };
    if (typeof pkg.version === 'string')
        addon.version = pkg.version;
    if (typeof pkg.engines?.bare === 'string')
        addon.enginesBare = pkg.engines.bare;
    return { addon, platformPackages: [...platformPackages].sort() };
}
function stringRecord(value) {
    const out = {};
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return out;
    for (const [key, range] of Object.entries(value)) {
        if (typeof range === 'string')
            out[key] = range;
    }
    return out;
}
function buildRecord(pkg, packageJsonPath, expectedName) {
    const name = typeof pkg.name === 'string' ? pkg.name : expectedName;
    if (!name)
        return null;
    const record = {
        name,
        packageJsonPath,
        isAddon: pkg.addon === true,
        dependencies: {
            ...stringRecord(pkg.peerDependencies),
            ...stringRecord(pkg.optionalDependencies),
            ...stringRecord(pkg.dependencies)
        }
    };
    if (typeof pkg.version === 'string')
        record.version = pkg.version;
    if (typeof pkg.engines?.bare === 'string')
        record.enginesBare = pkg.engines.bare;
    return record;
}
function buildInvalid(packageJsonPath, expectedName, reason) {
    const record = { packageJsonPath, reason };
    if (expectedName !== undefined)
        record.expectedName = expectedName;
    return record;
}
export function createCollectDiagnostics() {
    return { invalidPackageJsons: [], emptyResolutions: false, packages: [] };
}
/**
 * Caps concurrent filesystem calls so a large node_modules tree is read in
 * parallel without exhausting file descriptors.
 */
export function createLimiter(max) {
    let active = 0;
    const queue = [];
    // A finishing task hands its slot straight to the next waiter, so a caller
    // arriving in between cannot take it as well.
    function release() {
        const next = queue.shift();
        if (next)
            next();
        else
            active--;
    }
    async function run(task) {
        if (active >= max)
            await new Promise((resolve) => queue.push(resolve));
        else
            active++;
        try {
            return await task();
        }
        finally {
            release();
        }
    }
    return run;
}
export const FS_CONCURRENCY = 32;
export function formatAddonId(addon) {
    return `${addon.name}@${addon.version ?? 'unknown'}`;
}
export function deduplicateAddons(addons) {
    const byKey = new Map();
    for (const addon of addons) {
        const key = `${addon.name}@${addon.version ?? 'unknown'}::${addon.packageRoot}`;
        if (!byKey.has(key))
            byKey.set(key, addon);
    }
    return [...byKey.values()].sort((a, b) => formatAddonId(a).localeCompare(formatAddonId(b)) || a.packageRoot.localeCompare(b.packageRoot));
}
