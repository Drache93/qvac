import { promises as fsp } from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { formatAddonId } from './addon-source.js';
const RUNTIME_PACKAGES = [
    { source: 'bare-runtime', packageName: 'bare-runtime' },
    { source: 'bare', packageName: 'bare' }
];
export async function resolveBareRuntime(options) {
    if (options.explicitVersion) {
        // Caller (verifyBundle) pre-validates explicitVersion via normalizeVersion.
        return {
            resolved: true,
            runtime: {
                version: normalizeVersion(options.explicitVersion),
                source: options.explicitSource ?? 'flag'
            }
        };
    }
    const tried = [];
    for (const candidate of RUNTIME_PACKAGES) {
        const pkgJsonPath = path.join(options.projectRoot, 'node_modules', candidate.packageName, 'package.json');
        tried.push(pkgJsonPath);
        const version = await tryReadRuntimeVersion(pkgJsonPath);
        if (version) {
            return {
                resolved: true,
                runtime: { version, source: candidate.source }
            };
        }
    }
    return {
        resolved: false,
        error: {
            reason: 'Unable to detect installed Bare runtime version',
            triedPaths: tried
        }
    };
}
async function tryReadRuntimeVersion(pkgJsonPath) {
    let raw;
    try {
        raw = await fsp.readFile(pkgJsonPath, 'utf8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
    }
    const version = parsed['version'];
    return typeof version === 'string' ? normalizeVersion(version) : null;
}
export function normalizeVersion(value) {
    const coerced = semver.coerce(value, { includePrerelease: true });
    return coerced ? coerced.version : null;
}
export function formatConfigLabel(projectRoot, configPath) {
    if (!configPath)
        return 'qvac.config';
    const rel = path.relative(projectRoot, configPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel))
        return configPath;
    return rel;
}
export function formatRuntimeSource(runtime) {
    return runtime.detail === undefined ? runtime.source : `${runtime.source}: ${runtime.detail}`;
}
export function checkAbi(options) {
    const { addons, runtime, packages = [] } = options;
    const constrained = [
        ...addons.map((addon) => ({
            id: formatAddonId(addon),
            range: addon.enginesBare,
            isAddon: true
        })),
        ...packages.map((pkg) => ({ id: formatAddonId(pkg), range: pkg.enginesBare, isAddon: false }))
    ].filter((entry) => !!entry.range);
    if (constrained.length === 0)
        return [];
    const issues = [];
    const checkable = [];
    for (const entry of constrained) {
        if (!semver.validRange(entry.range)) {
            issues.push({
                code: 'malformed-engines-bare',
                level: 'warning',
                addon: entry.id,
                enginesBare: entry.range,
                message: `${entry.id} declares engines.bare "${entry.range}", which is ` +
                    `not a valid semver range. ABI check skipped for this ${entry.isAddon ? 'addon' : 'package'}. ` +
                    'Report this to the package maintainer.'
            });
            continue;
        }
        checkable.push(entry);
    }
    if (checkable.length === 0)
        return issues;
    if (!runtime.resolved) {
        issues.push({
            code: 'unknown-runtime-version',
            level: 'warning',
            message: `${runtime.error.reason}. ABI checks skipped for ${checkable.length} ` +
                `package${checkable.length === 1 ? '' : 's'}. ` +
                'For mobile hosts, install react-native-bare-kit; for a desktop build, ' +
                'install bare-runtime or pass bareRuntimeVersion.',
            triedPaths: runtime.error.triedPaths
        });
        return issues;
    }
    const { version } = runtime.runtime;
    for (const entry of checkable) {
        if (semver.satisfies(version, entry.range))
            continue;
        const message = `${entry.id} requires bare ${entry.range}, ` +
            `runtime is ${version} (from ${formatRuntimeSource(runtime.runtime)}).`;
        if (entry.isAddon) {
            issues.push({
                code: 'abi-mismatch',
                level: 'error',
                addon: entry.id,
                enginesBare: entry.range,
                runtimeVersion: version,
                message
            });
        }
        else {
            issues.push({
                code: 'engines-mismatch',
                level: 'error',
                package: entry.id,
                enginesBare: entry.range,
                runtimeVersion: version,
                message
            });
        }
    }
    return issues;
}
