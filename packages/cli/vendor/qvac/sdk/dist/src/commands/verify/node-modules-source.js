import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { createLimiter, deduplicateAddons, FS_CONCURRENCY, readAddonPackageJson } from './addon-source.js';
export class InvalidNodeModulesSourceError extends Error {
    nodeModulesPath;
    constructor(nodeModulesPath, cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`node_modules at ${nodeModulesPath} could not be read.\n\n` +
            `  Reason: ${reason}\n\n` +
            '  Run `npm install` before invoking verifyBundle against a node_modules tree.');
        this.name = 'InvalidNodeModulesSourceError';
        this.nodeModulesPath = nodeModulesPath;
    }
}
export async function collectAddonsFromNodeModules(options) {
    const { nodeModulesRoot, diagnostics } = options;
    const limit = createLimiter(FS_CONCURRENCY);
    const results = await walkNodeModules(nodeModulesRoot, limit, true);
    // A split addon is checked through its meta, which looks for each host's
    // prebuild in the platform package it names; checking the installed
    // platform packages as well would fail each one on every other host.
    const addons = [];
    const platformPackages = new Set();
    for (const result of results) {
        if (result.record !== undefined && diagnostics !== undefined) {
            diagnostics.packages.push(result.record);
        }
        if (result.isAddon && result.addon) {
            addons.push(result.addon);
        }
        else if (result.splitAddon !== undefined) {
            addons.push(result.splitAddon.addon);
            for (const name of result.splitAddon.platformPackages)
                platformPackages.add(name);
        }
        else if (result.invalid !== undefined && diagnostics !== undefined) {
            diagnostics.invalidPackageJsons.push(result.invalid);
        }
    }
    return deduplicateAddons(addons.filter((addon) => !platformPackages.has(addon.name)));
}
/**
 * Directory reads run in parallel under `limit`; results are concatenated in
 * directory-entry order so the output does not depend on I/O timing.
 */
async function walkNodeModules(nodeModulesDir, limit, isRoot) {
    let entries;
    try {
        entries = await limit(() => fsp.readdir(nodeModulesDir, { withFileTypes: true }));
    }
    catch (error) {
        if (isRoot)
            throw new InvalidNodeModulesSourceError(nodeModulesDir, error);
        return [];
    }
    const visits = entries
        .filter((entry) => !entry.name.startsWith('.') && isPackageEntry(entry))
        .map((entry) => entry.name.startsWith('@')
        ? walkScopeDirectory(path.join(nodeModulesDir, entry.name), limit)
        : visitPackageDirectory(path.join(nodeModulesDir, entry.name), entry.name, limit));
    return (await Promise.all(visits)).flat();
}
async function walkScopeDirectory(scopeDir, limit) {
    const scope = path.basename(scopeDir);
    let entries;
    try {
        entries = await limit(() => fsp.readdir(scopeDir, { withFileTypes: true }));
    }
    catch {
        return [];
    }
    const visits = entries
        .filter((entry) => !entry.name.startsWith('.') && isPackageEntry(entry))
        .map((entry) => visitPackageDirectory(path.join(scopeDir, entry.name), `${scope}/${entry.name}`, limit));
    return (await Promise.all(visits)).flat();
}
function isPackageEntry(entry) {
    return entry.isDirectory() || entry.isSymbolicLink();
}
async function visitPackageDirectory(packageDir, packageName, limit) {
    const [result, nested] = await Promise.all([
        limit(() => readAddonPackageJson({
            packageJsonPath: path.join(packageDir, 'package.json'),
            expectedName: packageName
        })),
        walkNodeModules(path.join(packageDir, 'node_modules'), limit, false)
    ]);
    return [result, ...nested];
}
