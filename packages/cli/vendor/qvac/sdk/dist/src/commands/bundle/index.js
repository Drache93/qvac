import fs, { promises as fsp } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_HOSTS, DEFAULT_SDK_NAME } from './constants.js';
import { CONFIG_CANDIDATES, resolveConfigForProject } from '../../client/config-loader/resolve-config.node.js';
import { createCommandLogger } from '../command-logger.js';
import { BareImportsMapNotFoundError, HostPrebuildsMissingError } from '../../utils/errors-client.js';
import { resolvePluginSpecifiers, parseBuiltinSpecifier } from './plugins.js';
import { generateWorkerEntries } from './entry-gen.js';
import { runBarePack } from './bare-pack.js';
import { AUDIO_DECODER_ADDON, extractBarePackHeader, extractPackedString, generateAddonsManifest } from './manifest.js';
import { createSdkImportResolver } from './resolve-sdk-import.js';
import { findMissingHostPrebuilds, installMissingHostPrebuilds, resolveAddons } from '../host-prebuilds/index.js';
import { verifyBundle } from '../verify/index.js';
import { formatRuntimeSource } from '../verify/abi.js';
import { formatEnginesAdvice } from '../verify/engines-advice.js';
const require = createRequire(import.meta.url);
function resolveSdkPath(projectRoot, explicitSdkPath) {
    if (explicitSdkPath) {
        return path.isAbsolute(explicitSdkPath)
            ? explicitSdkPath
            : path.join(projectRoot, explicitSdkPath);
    }
    try {
        const pkgJsonPath = require.resolve('@qvac/sdk/package.json', {
            paths: [projectRoot]
        });
        return path.dirname(pkgJsonPath);
    }
    catch {
        return path.join(projectRoot, 'node_modules', '@qvac', 'sdk');
    }
}
async function resolveSdkName(sdkPath) {
    const sdkPackageJsonPath = path.join(sdkPath, 'package.json');
    try {
        if (fs.existsSync(sdkPackageJsonPath)) {
            const content = await fsp.readFile(sdkPackageJsonPath, 'utf8');
            const pkg = JSON.parse(content);
            if (pkg.name)
                return pkg.name;
        }
    }
    catch {
        // Fall through to default
    }
    return DEFAULT_SDK_NAME;
}
function resolveImportsMapPath(sdkPath, sdkName) {
    const importsMapPath = path.join(sdkPath, 'bare-imports.json');
    if (fs.existsSync(importsMapPath)) {
        return importsMapPath;
    }
    throw new BareImportsMapNotFoundError(sdkName, importsMapPath);
}
const ENGINES_ISSUE_CODES = new Set(['abi-mismatch', 'engines-mismatch']);
const AUDIO_PLUGINS = new Set([
    'whispercpp-transcription',
    'bci-whispercpp-transcription',
    'parakeet-transcription',
    'moss-transcribe',
    'audiogen-ggml'
]);
function audioPluginsIn(pluginSpecifiers, sdkName) {
    return pluginSpecifiers.filter((specifier) => {
        const builtin = parseBuiltinSpecifier(specifier, sdkName);
        return builtin !== null && AUDIO_PLUGINS.has(builtin.suffix);
    });
}
async function checkBundleEngines(options) {
    const { projectRoot, bundlePath, hosts, configPath, network, logger } = options;
    logger.info('\n🔎 Checking engines.bare against the Bare runtime of each host...');
    const result = await verifyBundle({
        projectRoot,
        addonsSource: bundlePath,
        hosts,
        ...(configPath !== undefined ? { configPath } : {}),
        ...(network !== undefined ? { network } : {}),
        onProgress: (message) => logger.info(`   ${message}`)
    });
    const checkedHosts = [];
    for (const group of result.runtimes ?? []) {
        const label = group.hosts.join(', ');
        if (group.resolution.resolved) {
            checkedHosts.push(...group.hosts);
            logger.info(`   ${label}: Bare ${group.resolution.runtime.version} (from ${formatRuntimeSource(group.resolution.runtime)})`);
        }
        else {
            logger.warn(`engines.bare not checked for ${label}: ${group.resolution.error.reason}`);
        }
    }
    const mismatches = result.issues.filter((issue) => ENGINES_ISSUE_CODES.has(issue.code) && issue.level === 'error');
    if (mismatches.length === 0) {
        if (checkedHosts.length > 0) {
            logger.info(`   No engines.bare mismatches for ${checkedHosts.join(', ')}`);
        }
        return;
    }
    const lines = ['The bundle contains packages that require a newer Bare runtime:'];
    for (const issue of mismatches)
        lines.push(`  - ${issue.message}`);
    lines.push('');
    for (const advice of result.advice ?? [])
        lines.push(...formatEnginesAdvice(advice));
    logger.warn(lines.join('\n').trimEnd());
}
export async function bundleSdk(options = {}) {
    const startTime = Date.now();
    const projectRoot = options.projectRoot ?? process.cwd();
    const outputDir = path.join(projectRoot, 'qvac');
    const entryPath = path.join(outputDir, 'worker.entry.mjs');
    const bundleEntryPath = path.join(outputDir, 'worker.bundle.entry.mjs');
    const bundlePath = path.join(outputDir, 'worker.bundle.js');
    const logger = createCommandLogger(options);
    logger.info('🔧 QVAC SDK Worker Bundler\n');
    const { configPath, config } = await resolveConfigForProject(projectRoot, options.configPath);
    if (configPath) {
        logger.info(`📄 Config: ${path.relative(projectRoot, configPath)}`);
    }
    else {
        logger.info('📄 Config: (none)');
        logger.warn('No config file found — continuing with defaults.');
        logger.info('   To customize bundling, create one of:\n' +
            CONFIG_CANDIDATES.map((c) => `     - ${c}`).join('\n') +
            '\n');
    }
    const sdkPath = resolveSdkPath(projectRoot, options.sdkPath);
    const sdkName = await resolveSdkName(sdkPath);
    logger.info(`📦 SDK: ${sdkName}`);
    logger.debug(`   Path: ${sdkPath}`);
    const importsMapPath = resolveImportsMapPath(sdkPath, sdkName);
    const pluginSpecifiers = resolvePluginSpecifiers(config, sdkName, logger);
    logger.info(`\n📦 Plugins to include (${pluginSpecifiers.length}):`);
    for (const spec of pluginSpecifiers) {
        const label = parseBuiltinSpecifier(spec, sdkName) ? '✓ built-in' : '⊕ custom';
        logger.info(`   ${label}: ${spec}`);
    }
    const hosts = options.hosts && options.hosts.length > 0 ? options.hosts : DEFAULT_HOSTS;
    const explicitDefer = options.defer ?? [];
    const includeAudioDecoder = config.includeAudioDecoder !== false && !explicitDefer.includes(AUDIO_DECODER_ADDON);
    const deferModules = includeAudioDecoder
        ? explicitDefer
        : [...new Set([...explicitDefer, AUDIO_DECODER_ADDON])];
    if (!includeAudioDecoder) {
        const affected = audioPluginsIn(pluginSpecifiers, sdkName);
        if (affected.length > 0) {
            logger.warn(`${AUDIO_DECODER_ADDON} is not bundled: ${affected.join(', ')} cannot decode compressed audio files; compressed audiogen output formats also require FFmpeg.`);
        }
    }
    await fsp.mkdir(outputDir, { recursive: true });
    logger.info('\n📝 Generating worker entry...');
    const resolveSdkImport = createSdkImportResolver(sdkPath, sdkName);
    const { runtimeEntry, bundleEntry } = generateWorkerEntries(pluginSpecifiers, sdkName, resolveSdkImport, config.rpcServerProvider);
    await fsp.writeFile(entryPath, runtimeEntry, 'utf8');
    logger.info(`   Created: ${path.relative(projectRoot, entryPath)}`);
    logger.info(`   Using: ${path.relative(projectRoot, importsMapPath)}`);
    logger.info('\n🔨 Bundling with bare-pack...');
    logger.debug(`   Hosts: ${hosts.join(', ')}`);
    if (deferModules.length > 0) {
        logger.debug(`   Deferred: ${deferModules.join(', ')}`);
    }
    // Missing mobile platform packages are installed, or reported, before bundling.
    let installedPrebuilds = [];
    const barePackOptions = {
        entryPath: bundleEntryPath,
        hosts,
        importsMapPath,
        quiet: options.quiet === true,
        logger
    };
    const addonsMissingPlatformPackages = () => reachedAddonsMissingPlatformPackages({
        addons: async () => (await resolveAddons(projectRoot, undefined, logger)).filter((addon) => !deferModules.includes(addon.name)),
        hosts,
        scan: (extraDefer, outputPath) => runBarePack({
            ...barePackOptions,
            outputPath,
            deferModules: [...deferModules, ...extraDefer],
            quiet: true
        }),
        scanPath: path.join(outputDir, 'worker.scan.bundle.js'),
        logger
    });
    try {
        await fsp.writeFile(bundleEntryPath, bundleEntry, 'utf8');
        const addons = await addonsMissingPlatformPackages();
        if (options.installMissingPrebuilds === true) {
            const { installed } = await installMissingHostPrebuilds({
                projectRoot,
                hosts,
                addons,
                quiet: options.quiet === true,
                logger
            });
            installedPrebuilds = installed;
        }
        else {
            await throwIfPlatformPackagesMissing(addons, hosts);
        }
        await runBarePack({ ...barePackOptions, outputPath: bundlePath, deferModules });
    }
    finally {
        await fsp.rm(bundleEntryPath, { force: true });
    }
    const stats = await fsp.stat(bundlePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    logger.info(`\n✅ Bundle created: ${path.relative(projectRoot, bundlePath)}`);
    logger.info(`   Size: ${sizeKB} KB`);
    const manifestResult = await generateAddonsManifest({
        bundlePath,
        outputDir,
        projectRoot,
        logger,
        includeAudioDecoder
    });
    if (options.checkEngines !== false) {
        await checkBundleEngines({
            projectRoot,
            bundlePath,
            hosts,
            configPath: configPath ?? undefined,
            network: options.network,
            logger
        });
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`\n🎉 Done in ${elapsed}s!\n`);
    logger.info('Generated files:');
    logger.info('  - qvac/worker.entry.mjs    (standalone worker with RPC + lifecycle)');
    logger.info('  - qvac/worker.bundle.js    (mobile bundle for Expo/React Native BareKit)');
    logger.info('  - qvac/addons.manifest.json\n');
    logger.info('Mobile: Expo plugin auto-configures worker.bundle.js');
    logger.info('Standalone: Import qvac/worker.entry.mjs for full worker with RPC\n');
    return {
        bundlePath,
        plugins: pluginSpecifiers,
        addons: manifestResult.addons,
        entryPaths: {
            worker: entryPath
        },
        manifestPath: manifestResult.manifestPath,
        installedPrebuilds
    };
}
/**
 * The installed split addons that the bundle reaches and that are missing a
 * mobile platform package. Every installed addon is a candidate (`@qvac/sdk`
 * depends on all of them), so a first bare-pack pass defers each missing
 * platform package: bare-pack then records the reached ones as
 * `deferred:<package>` and never visits the rest. Empty when nothing is
 * missing, or when that pass fails, which leaves the real bundle to report
 * the failure.
 */
async function reachedAddonsMissingPlatformPackages(options) {
    const { hosts, scan, scanPath, logger } = options;
    const addons = await options.addons();
    const missing = await findMissingHostPrebuilds(addons, hosts);
    if (missing.length === 0)
        return [];
    logger.debug(`\n🔎 Checking which of ${missing.length} missing platform packages the bundle reaches...`);
    try {
        await scan(missing.map((pkg) => pkg.name), scanPath);
        const reached = deferredSpecifiers(await fsp.readFile(scanPath, 'utf8'));
        const owners = new Set(missing.filter((pkg) => reached.has(pkg.name)).map((pkg) => pkg.addon));
        return addons.filter((addon) => owners.has(addon.name));
    }
    catch (error) {
        logger.debug(`   Scan failed: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
    finally {
        await fsp.rm(scanPath, { force: true });
    }
}
const DEFERRED_PROTOCOL = 'deferred:';
/** Every specifier a bare-pack bundle leaves as `deferred:<specifier>`. */
function deferredSpecifiers(bundleText) {
    const { resolutions = {} } = extractBarePackHeader(extractPackedString(bundleText));
    const found = new Set();
    const visit = (value) => {
        if (typeof value === 'string') {
            if (value.startsWith(DEFERRED_PROTOCOL))
                found.add(value.slice(DEFERRED_PROTOCOL.length));
        }
        else if (value !== null && typeof value === 'object') {
            for (const nested of Object.values(value))
                visit(nested);
        }
    };
    visit(resolutions);
    return found;
}
/**
 * Throws `HostPrebuildsMissingError` when split addons are missing mobile
 * platform packages, naming the exact pins.
 */
async function throwIfPlatformPackagesMissing(addons, hosts) {
    let missing;
    try {
        missing = await findMissingHostPrebuilds(addons, hosts);
    }
    catch {
        return;
    }
    if (missing.length === 0)
        return;
    throw new HostPrebuildsMissingError(Object.fromEntries(missing.map((pkg) => [pkg.name, pkg.version])));
}
