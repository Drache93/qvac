import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { formatAddonId } from './addon-source.js';
import { HOST_ADDON_IMPORT, resolveAddonPlatformPackage } from './platform-addons.js';
/** Platforms no install host reports, so their platform packages must be declared. */
const MOBILE_PLATFORMS = new Set(['android', 'ios']);
export function isMobileHost(host) {
    return MOBILE_PLATFORMS.has(host.split('-')[0] ?? '');
}
const PREBUILDS_DIR = 'prebuilds';
const INNER_ADDON_DIR = 'addon';
/**
 * Where an addon's `<host>` prebuild may live:
 *
 * - `<packageRoot>/prebuilds/<host>` for an ordinary addon, including the
 *   per-platform packages themselves.
 * - For a split addon, the platform package its `#host-addon` map names for
 *   this host: `<platformRoot>/prebuilds/<host>` when that package is an
 *   addon, `<platformRoot>/addon/prebuilds/<host>` when it wraps an inner
 *   addon. Empty when the package is not installed.
 */
export async function resolvePrebuildLocations(addon, host) {
    const platformPackage = await platformPackageForHost(addon, host);
    if (platformPackage === null) {
        return [{ hostDir: path.join(addon.packageRoot, PREBUILDS_DIR, host) }];
    }
    const platformRoot = await findInstalledPackage(await realPackageRoot(addon.packageRoot), platformPackage);
    if (platformRoot === null)
        return [];
    const manifest = await readPackageManifest(platformRoot);
    const addonRoot = manifest?.addon === true ? platformRoot : path.join(platformRoot, INNER_ADDON_DIR);
    const location = {
        hostDir: path.join(addonRoot, PREBUILDS_DIR, host),
        platformPackage
    };
    const installedVersion = manifest?.version;
    if (addon.version !== undefined &&
        installedVersion !== undefined &&
        installedVersion !== addon.version) {
        location.mismatchedVersion = installedVersion;
    }
    if (addonRoot !== platformRoot) {
        const nestedVersion = (await readPackageManifest(addonRoot))?.version;
        if (location.mismatchedVersion === undefined &&
            addon.version !== undefined &&
            nestedVersion !== undefined &&
            nestedVersion !== addon.version) {
            location.mismatchedVersion = nestedVersion;
        }
    }
    return [location];
}
/**
 * The directory the addon really lives in. Under pnpm's isolated layout
 * `node_modules/@qvac/tts-ggml` is a symlink into the virtual store
 * (`node_modules/.pnpm/<id>/node_modules/@qvac/tts-ggml`), and the addon's
 * dependencies — its platform package included — are linked next to it in
 * that store directory rather than at the project's top-level `node_modules`.
 * Node resolves from the real path, so the platform-package search starts
 * there too. An unresolvable path (a fixture, a bundle path that no longer
 * exists) is searched as given.
 */
async function realPackageRoot(packageRoot) {
    try {
        return await fsp.realpath(packageRoot);
    }
    catch {
        return path.resolve(packageRoot);
    }
}
export async function checkPrebuilds(options) {
    const { addon, hosts } = options;
    const issues = [];
    for (const host of hosts) {
        if (addon.linkedHosts !== undefined && !addon.linkedHosts.includes(host))
            continue;
        const locations = await resolvePrebuildLocations(addon, host);
        if (await anyLocationHasPrebuild(locations))
            continue;
        const platformPackage = await platformPackageForHost(addon, host);
        const platformLocation = locations.find((location) => location.platformPackage !== undefined);
        const issue = {
            code: 'missing-prebuild',
            level: 'error',
            addon: formatAddonId(addon),
            host,
            packageRoot: addon.packageRoot,
            message: describeMissingPrebuild(addon, host, locations, platformPackage, platformLocation)
        };
        const needsPin = isMobileHost(host) &&
            (platformLocation === undefined || platformLocation.mismatchedVersion !== undefined);
        if (platformPackage !== null && addon.version !== undefined && needsPin) {
            issue.platformPackage = { name: platformPackage, version: addon.version };
        }
        issues.push(issue);
    }
    return issues;
}
async function anyLocationHasPrebuild(locations) {
    for (const location of locations) {
        if (location.mismatchedVersion !== undefined)
            continue;
        if ((await listBarePrebuildFiles(location.hostDir)).length > 0)
            return true;
    }
    return false;
}
function describeMissingPrebuild(addon, host, locations, platformPackage, platformLocation) {
    const expected = locations.length > 0
        ? locations.map((location) => path.join(location.hostDir, '*.bare')).join(' or ')
        : `${platformPackage ?? addon.name} to be installed with ${path.join(PREBUILDS_DIR, host, '*.bare')}`;
    return (`${formatAddonId(addon)} is missing a prebuild for ${host} ` +
        `(expected ${expected}).` +
        missingPlatformPackageHint(addon, platformPackage, platformLocation));
}
function missingPlatformPackageHint(addon, platformPackage, platformLocation) {
    if (platformPackage === null)
        return '';
    const pin = addon.version === undefined ? platformPackage : `"${platformPackage}": "${addon.version}"`;
    if (platformLocation === undefined) {
        return (` Add this exact dependency to package.json (same version as ${addon.name})` +
            ` and reinstall: ${pin}`);
    }
    if (platformLocation.mismatchedVersion !== undefined) {
        return (` ${platformPackage} ${platformLocation.mismatchedVersion} is installed, but it must be` +
            ` the same version as ${addon.name}. Pin it in package.json and reinstall: ${pin}`);
    }
    return '';
}
async function platformPackageForHost(addon, host) {
    return resolveAddonPlatformPackage(addon.name, await readHostAddonMap(addon), host);
}
async function readPackageManifest(packageRoot) {
    try {
        const parsed = JSON.parse(await fsp.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
        if (typeof parsed !== 'object' || parsed === null)
            return undefined;
        const { version, addon } = parsed;
        return typeof version === 'string'
            ? { version, addon: addon === true }
            : { addon: addon === true };
    }
    catch {
        return undefined;
    }
}
async function readHostAddonMap(addon) {
    try {
        const raw = await fsp.readFile(path.join(addon.packageRoot, 'package.json'), 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
            return undefined;
        const imports = parsed.imports;
        return imports?.[HOST_ADDON_IMPORT];
    }
    catch {
        return undefined;
    }
}
/**
 * Locates `packageName` the way Node's resolver would from `fromDir`: in
 * `<dir>/node_modules/<packageName>` for `fromDir` and each of its ancestors.
 * Covers a hoisted platform package next to the meta package, one nested
 * under the meta package's own `node_modules`, and — given the meta package's
 * real path — the sibling link pnpm places in its virtual-store directory.
 */
async function findInstalledPackage(fromDir, packageName) {
    let dir = path.resolve(fromDir);
    for (;;) {
        const candidate = path.join(dir, 'node_modules', packageName);
        if (await isPackageDir(candidate))
            return candidate;
        const parent = path.dirname(dir);
        if (parent === dir)
            return null;
        dir = parent;
    }
}
async function isPackageDir(dir) {
    try {
        const stat = await fsp.stat(path.join(dir, 'package.json'));
        return stat.isFile();
    }
    catch {
        return false;
    }
}
export async function listBarePrebuildFiles(hostDir) {
    let entries;
    try {
        entries = await fsp.readdir(hostDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.bare'))
        .map((entry) => path.resolve(hostDir, entry.name))
        .sort();
}
