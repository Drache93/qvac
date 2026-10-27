import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { resolveConfigFileInProject, loadConfigFromPath } from '../../client/config-loader/resolve-config.node.js';
import { createCollectDiagnostics, formatAddonId } from './addon-source.js';
import { collectAddonsFromBundle, InvalidBundleSourceError } from './bundle-source.js';
import { collectAddonsFromNodeModules, InvalidNodeModulesSourceError } from './node-modules-source.js';
import { checkPrebuilds, isMobileHost } from './prebuilds.js';
import { checkAbi, formatConfigLabel, normalizeVersion, resolveBareRuntime } from './abi.js';
import { isReactNativeBareKitInstalled, resolveMobileBareRuntime } from './bare-kit-runtime.js';
import { buildEnginesAdvice, formatEnginesAdvice } from './engines-advice.js';
export async function verifyBundle(options) {
    const { projectRoot, addonsSource, hosts, bareRuntimeVersion, configPath } = options;
    const resolvedAddonsSource = path.isAbsolute(addonsSource)
        ? addonsSource
        : path.resolve(projectRoot, addonsSource);
    if (hosts.length === 0) {
        return {
            addonsSource,
            resolvedAddonsSource,
            sourceKind: null,
            hosts,
            runtime: null,
            addons: [],
            issues: [
                {
                    code: 'invalid-source',
                    level: 'error',
                    addonsSource,
                    message: 'At least one host is required.'
                }
            ]
        };
    }
    let invalidRuntimeVersion = null;
    if (bareRuntimeVersion !== undefined && normalizeVersion(bareRuntimeVersion) === null) {
        invalidRuntimeVersion = {
            code: 'invalid-runtime-version',
            level: 'error',
            providedValue: bareRuntimeVersion,
            source: 'flag',
            message: `bareRuntimeVersion "${bareRuntimeVersion}" is not a valid semver. ` +
                'Use a version like 1.15.0 (with optional v-prefix and pre-release tag) or omit it to use auto-detection.'
        };
    }
    let configRuntimeVersion;
    let resolvedConfigPath = null;
    let configLoadFailed = null;
    try {
        resolvedConfigPath = await resolveConfigFileInProject(projectRoot, configPath ?? undefined);
        if (resolvedConfigPath !== null) {
            const config = await loadConfigFromPath(resolvedConfigPath);
            if (typeof config.bareRuntimeVersion === 'string') {
                configRuntimeVersion = config.bareRuntimeVersion;
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (configPath !== undefined) {
            return {
                addonsSource,
                resolvedAddonsSource,
                sourceKind: null,
                hosts,
                runtime: null,
                addons: [],
                issues: [
                    {
                        code: 'invalid-source',
                        level: 'error',
                        addonsSource,
                        message: `Failed to load config from '${configPath}': ${message}`
                    }
                ]
            };
        }
        if (resolvedConfigPath !== null) {
            configLoadFailed = {
                code: 'config-load-failed',
                level: 'warning',
                configPath: resolvedConfigPath,
                reason: message,
                message: `Found ${formatConfigLabel(projectRoot, resolvedConfigPath)} but failed to load it: ${message}. ` +
                    'Falling back to auto-detection for Bare runtime; the project-pinned ' +
                    '`bareRuntimeVersion` is being ignored. Fix the config file or pass `configPath` explicitly to surface it as an error.'
            };
        }
    }
    if (invalidRuntimeVersion === null &&
        bareRuntimeVersion === undefined &&
        configRuntimeVersion !== undefined &&
        normalizeVersion(configRuntimeVersion) === null) {
        invalidRuntimeVersion = {
            code: 'invalid-runtime-version',
            level: 'error',
            providedValue: configRuntimeVersion,
            source: 'config',
            message: `\`bareRuntimeVersion\` in ${formatConfigLabel(projectRoot, resolvedConfigPath ?? undefined)} ` +
                `"${configRuntimeVersion}" is not a valid semver. ` +
                'Use a version like 1.15.0 (with optional v-prefix and pre-release tag), or remove the field to use auto-detection.'
        };
    }
    const sourceKind = await detectSourceKind(resolvedAddonsSource);
    if (sourceKind === null) {
        return {
            addonsSource,
            resolvedAddonsSource,
            sourceKind: null,
            hosts,
            runtime: null,
            addons: [],
            issues: [
                {
                    code: 'invalid-source',
                    level: 'error',
                    addonsSource,
                    message: `--addons-source ${addonsSource} is not a readable file or directory ` +
                        `(resolved to ${resolvedAddonsSource}).`
                }
            ]
        };
    }
    const diagnostics = createCollectDiagnostics();
    if (sourceKind === 'node-modules') {
        options.onProgress?.(`Scanning ${resolvedAddonsSource} for native addons and engines.bare...`);
    }
    let addons;
    try {
        addons =
            sourceKind === 'bare-pack-bundle'
                ? await collectAddonsFromBundle({
                    bundlePath: resolvedAddonsSource,
                    projectRoot,
                    hosts,
                    diagnostics
                })
                : await collectAddonsFromNodeModules({
                    nodeModulesRoot: resolvedAddonsSource,
                    diagnostics
                });
    }
    catch (error) {
        if (error instanceof InvalidBundleSourceError ||
            error instanceof InvalidNodeModulesSourceError) {
            return {
                addonsSource,
                resolvedAddonsSource,
                sourceKind,
                hosts,
                runtime: null,
                addons: [],
                issues: [
                    {
                        code: 'invalid-source',
                        level: 'error',
                        addonsSource,
                        message: error.message
                    }
                ]
            };
        }
        throw error;
    }
    const issues = [];
    if (configLoadFailed !== null)
        issues.push(configLoadFailed);
    if (invalidRuntimeVersion !== null)
        issues.push(invalidRuntimeVersion);
    issues.push(...buildInvalidPackageJsonIssues(diagnostics.invalidPackageJsons));
    if (sourceKind === 'bare-pack-bundle' && diagnostics.emptyResolutions) {
        issues.push({
            code: 'empty-bundle-resolutions',
            level: 'warning',
            bundlePath: resolvedAddonsSource,
            message: `Bundle at ${resolvedAddonsSource} has no resolutions in its bare-pack header ` +
                '(0 packages discoverable). The verifier cannot inspect any addons in this bundle; ' +
                '`Native addon verification passed` would be vacuous. Regenerate the bundle via ' +
                '`qvac bundle sdk` and re-run, or check for a corrupted/empty bundle file.'
        });
    }
    for (const addon of addons) {
        const prebuildIssues = await checkPrebuilds({ addon, hosts });
        issues.push(...prebuildIssues);
    }
    let runtime = null;
    let runtimes;
    const advice = [];
    if (invalidRuntimeVersion === null) {
        const explicit = bareRuntimeVersion !== undefined
            ? { version: bareRuntimeVersion, source: 'flag' }
            : configRuntimeVersion !== undefined
                ? { version: configRuntimeVersion, source: 'config' }
                : null;
        runtimes = await resolveRuntimeGroups({
            projectRoot,
            hosts,
            explicit,
            network: options.network,
            onProgress: options.onProgress,
            fetchText: options.fetchText
        });
        runtime = runtimes[0]?.resolution ?? null;
        const packages = enginesPackages(diagnostics.packages);
        const seen = new Set();
        for (const group of runtimes) {
            const groupIssues = checkAbi({
                addons: addonsLinkedOn(addons, group.hosts),
                runtime: group.resolution,
                packages
            }).filter((issue) => {
                if (seen.has(issue.message))
                    return false;
                seen.add(issue.message);
                return true;
            });
            issues.push(...groupIssues);
            const failures = groupIssues.flatMap((issue) => issue.code === 'abi-mismatch' || issue.code === 'engines-mismatch'
                ? [
                    failureOf(issue.code === 'abi-mismatch' ? issue.addon : issue.package, issue.enginesBare)
                ]
                : []);
            if (failures.length > 0 && group.resolution.resolved) {
                advice.push(await buildEnginesAdvice({
                    projectRoot,
                    hosts: group.hosts,
                    runtime: group.resolution.runtime,
                    failures,
                    packages: diagnostics.packages,
                    network: options.network,
                    onProgress: options.onProgress,
                    fetchPackageMetadata: options.fetchPackageMetadata
                }));
            }
        }
    }
    const result = {
        addonsSource,
        resolvedAddonsSource,
        sourceKind,
        hosts,
        runtime,
        addons,
        issues
    };
    if (runtimes !== undefined)
        result.runtimes = runtimes;
    if (advice.length > 0)
        result.advice = advice;
    return result;
}
/** `name@version` ids as built by `formatAddonId`; scoped names keep their leading `@`. */
function failureOf(id, enginesBare) {
    const at = id.lastIndexOf('@');
    if (at <= 0)
        return { name: id, enginesBare };
    const version = id.slice(at + 1);
    return version === 'unknown'
        ? { name: id.slice(0, at), enginesBare }
        : { name: id.slice(0, at), version, enginesBare };
}
/**
 * Addons a runtime group loads: those the bundle links on one of its hosts.
 * Without link information (`linkedHosts` unset), every addon counts, as in
 * `checkPrebuilds`.
 */
function addonsLinkedOn(addons, hosts) {
    return addons.filter((addon) => addon.linkedHosts === undefined || addon.linkedHosts.some((host) => hosts.includes(host)));
}
function enginesPackages(records) {
    const byId = new Map();
    for (const record of records) {
        if (record.isAddon || record.enginesBare === undefined)
            continue;
        const id = `${record.name}@${record.version ?? 'unknown'}`;
        if (byId.has(id))
            continue;
        const pkg = { name: record.name, enginesBare: record.enginesBare };
        if (record.version !== undefined)
            pkg.version = record.version;
        byId.set(id, pkg);
    }
    return [...byId.values()];
}
/**
 * Mobile hosts run the Bare build inside react-native-bare-kit; desktop hosts
 * run `bare-runtime` (or `bare`). An explicit version applies to every host.
 * Without react-native-bare-kit installed, mobile hosts fall back to the
 * desktop detection so projects that only bundle for mobile keep a runtime.
 */
async function resolveRuntimeGroups(options) {
    const { projectRoot, hosts, explicit } = options;
    if (explicit !== null) {
        return [
            {
                hosts,
                resolution: await resolveBareRuntime({
                    projectRoot,
                    explicitVersion: explicit.version,
                    explicitSource: explicit.source
                })
            }
        ];
    }
    const mobileHosts = hosts.filter(isMobileHost);
    const desktopHosts = hosts.filter((host) => !isMobileHost(host));
    const groups = [];
    if (mobileHosts.length > 0) {
        groups.push({
            hosts: mobileHosts,
            resolution: isReactNativeBareKitInstalled(projectRoot)
                ? await resolveMobileBareRuntime({
                    projectRoot,
                    network: options.network,
                    onProgress: options.onProgress,
                    fetchText: options.fetchText
                })
                : await resolveBareRuntime({ projectRoot })
        });
    }
    if (desktopHosts.length > 0) {
        groups.push({ hosts: desktopHosts, resolution: await resolveBareRuntime({ projectRoot }) });
    }
    return groups;
}
function buildInvalidPackageJsonIssues(records) {
    return records.map((record) => {
        const issue = {
            code: 'invalid-package-json',
            level: 'warning',
            packageJsonPath: record.packageJsonPath,
            reason: record.reason,
            message: `Skipping ${record.expectedName ?? record.packageJsonPath}: ` +
                `${record.reason}. The package is being treated as a non-addon; if it ships ` +
                'native code, the verifier cannot check its prebuilds or ABI. ' +
                'Fix the package.json or remove the package.'
        };
        if (record.expectedName !== undefined)
            issue.expectedName = record.expectedName;
        return issue;
    });
}
async function detectSourceKind(resolvedAddonsSource) {
    try {
        const stat = await fsp.stat(resolvedAddonsSource);
        if (stat.isFile())
            return 'bare-pack-bundle';
        if (stat.isDirectory())
            return 'node-modules';
        return null;
    }
    catch {
        return null;
    }
}
export function hasErrors(result) {
    return result.issues.some((issue) => issue.level === 'error');
}
export function hasWarnings(result) {
    return result.issues.some((issue) => issue.level === 'warning');
}
export function formatVerifyBundleResult(result) {
    const sections = [];
    const hostList = result.hosts.join(', ');
    if (result.issues.length === 0) {
        sections.push(`Native addon verification passed for ${result.addons.length} ` +
            `addon${result.addons.length === 1 ? '' : 's'} across ${result.hosts.length} ` +
            `host${result.hosts.length === 1 ? '' : 's'}: ${hostList}`);
        if (result.addons.length > 0) {
            sections.push('');
            sections.push('  Verified addons:');
            for (const addon of result.addons) {
                sections.push(`    - ${formatAddonId(addon)}`);
            }
        }
        return sections.join('\n');
    }
    if (hasErrors(result)) {
        sections.push('Native addon verification failed:');
    }
    else {
        sections.push('Native addon verification produced warnings:');
    }
    sections.push('');
    sections.push(...formatMissingPrebuilds(result.issues));
    sections.push(...formatAbiMismatches(result.issues));
    sections.push(...formatEnginesMismatches(result.issues));
    for (const advice of result.advice ?? [])
        sections.push(...formatEnginesAdvice(advice));
    sections.push(...formatInvalidRuntimeVersions(result.issues));
    sections.push(...formatMalformedEnginesBare(result.issues));
    sections.push(...formatConfigLoadFailed(result.issues));
    sections.push(...formatInvalidPackageJsons(result.issues));
    sections.push(...formatEmptyBundleResolutions(result.issues));
    sections.push(...formatUnknownRuntime(result.issues));
    sections.push(...formatInvalidSources(result.issues));
    return sections.join('\n').trimEnd();
}
function formatConfigLoadFailed(issues) {
    const matches = issues.filter((issue) => issue.code === 'config-load-failed');
    if (matches.length === 0)
        return [];
    const lines = ['  Config load failed:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatMissingPrebuilds(issues) {
    const matches = issues.filter((issue) => issue.code === 'missing-prebuild');
    if (matches.length === 0)
        return [];
    const lines = ['  Missing prebuild:'];
    for (const issue of matches) {
        const pin = issue.platformPackage;
        const needs = pin === undefined ? '' : ` (needs "${pin.name}": "${pin.version}" in package.json)`;
        lines.push(`    - ${issue.addon} for ${issue.host}${needs}`);
    }
    lines.push('');
    return lines;
}
function formatAbiMismatches(issues) {
    const matches = issues.filter((issue) => issue.code === 'abi-mismatch');
    if (matches.length === 0)
        return [];
    const lines = ['  ABI mismatch:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.addon} requires bare ${issue.enginesBare}, ` +
            `runtime is ${issue.runtimeVersion}`);
    }
    lines.push('');
    return lines;
}
function formatEnginesMismatches(issues) {
    const matches = issues.filter((issue) => issue.code === 'engines-mismatch');
    if (matches.length === 0)
        return [];
    const lines = ['  engines.bare mismatch:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.package} requires bare ${issue.enginesBare}, ` +
            `runtime is ${issue.runtimeVersion}`);
    }
    lines.push('');
    return lines;
}
function formatUnknownRuntime(issues) {
    const matches = issues.filter((issue) => issue.code === 'unknown-runtime-version');
    if (matches.length === 0)
        return [];
    const lines = ['  Unknown runtime version:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatMalformedEnginesBare(issues) {
    const matches = issues.filter((issue) => issue.code === 'malformed-engines-bare');
    if (matches.length === 0)
        return [];
    const lines = ['  Malformed engines.bare:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatInvalidSources(issues) {
    const matches = issues.filter((issue) => issue.code === 'invalid-source');
    if (matches.length === 0)
        return [];
    const lines = ['  Invalid source:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatInvalidRuntimeVersions(issues) {
    const matches = issues.filter((issue) => issue.code === 'invalid-runtime-version');
    if (matches.length === 0)
        return [];
    const lines = ['  Invalid Bare runtime version:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatInvalidPackageJsons(issues) {
    const matches = issues.filter((issue) => issue.code === 'invalid-package-json');
    if (matches.length === 0)
        return [];
    const lines = ['  Invalid package.json (skipped):'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
function formatEmptyBundleResolutions(issues) {
    const matches = issues.filter((issue) => issue.code === 'empty-bundle-resolutions');
    if (matches.length === 0)
        return [];
    const lines = ['  Empty bundle resolutions:'];
    for (const issue of matches) {
        lines.push(`    - ${issue.message}`);
    }
    lines.push('');
    return lines;
}
