import fs from 'fs';
import { createHash } from 'crypto';
import { platform } from 'os';
import path from 'path';
import { errorCode } from '../../guards.js';
import { parseSkillFrontMatter } from './frontmatter-parser.js';
import { buildCliValidator, loadSkillCli } from './cli-schema.js';
import { isModelCompatible, isStub, isToolSupported, resolveSkillState, SKILL_STATE, supportsPlatform } from './skill-state.js';
import { validateCredentialChecks } from './credential-check.js';
import { Agent } from '../../agent/index.js';
import { deriveSetup } from './setup-routes.js';
import { resolveSkillsOverlayDir } from './overlay-dir.js';
import { parseOperationsManifest } from '../operations/manifest.js';
import { HarnessLog } from '../../log.js';
export function skillSupportsPlatform(entry, platform) {
    return supportsPlatform(entry, platform);
}
export function versionProbeSkills(catalog, { installedTools, platform, readiness }) {
    return catalog.filter((entry) => readiness?.get(entry.name)?.probeVersions !== false &&
        entry.requires?.binMinVersions &&
        skillSupportsPlatform(entry, platform) &&
        !entry.stub &&
        entry.tools.every((name) => installedTools.has(Agent.parseToolGrant(name).name)));
}
export function availableSkills(catalog, installedTools, activeProfile) {
    return catalog.filter((skill) => !isStub(skill) &&
        isToolSupported(skill, installedTools) &&
        isModelCompatible(skill, activeProfile));
}
export function skillsEligibleForCredentialProbe(catalog, { platform, installedTools } = {}) {
    return catalog.filter((entry) => supportsPlatform(entry, platform) &&
        !isStub(entry) &&
        (!installedTools || isToolSupported(entry, installedTools)));
}
export function resolveSkillStatuses(catalog, { installedTools, credentialStore, settingsStore, platform, agentId, activeProfile, binVersions, refresh, skipCredentialProbe, fetchImpl, readiness } = {}) {
    const probeCatalog = skillsEligibleForCredentialProbe(catalog, { platform, installedTools });
    const checked = skipCredentialProbe
        ? Promise.resolve()
        : validateCredentialChecks(probeCatalog, { credentialStore, agentId, fetchImpl, refresh });
    return checked.then(() => Promise.all(catalog.map(async (entry) => withSetup(entry, installedTools && !isToolSupported(entry, installedTools)
        ? SKILL_STATE.unsupported
        : await resolveSkillState(entry, {
            credentialStore,
            settingsStore,
            platform,
            agentId,
            activeProfile,
            binVersions: binVersions?.get(entry.name),
            readiness: readiness?.get(entry.name)
        })))));
}
function withSetup(entry, state) {
    const { install, setup: _setup, requires, ...rest } = entry;
    const setup = deriveSetup(entry, state);
    return {
        ...rest,
        requires: requires ? stripCredentialChecks(requires) : undefined,
        install,
        setup,
        status: state
    };
}
function stripCredentialChecks(requires) {
    const { credentialChecks: _drop, ...rest } = requires;
    return rest;
}
export async function loadSkillCatalog(skillsDir, { platform = detectPlatform(), overlayDir = resolveSkillsOverlayDir() } = {}) {
    const byName = await loadRoot(skillsDir);
    if (overlayDir) {
        for (const [name, overlay] of await loadRoot(overlayDir, 'overlay')) {
            byName.set(name, mergeOverlay(byName.get(name), overlay));
        }
    }
    return [...byName.values()]
        .filter((entry) => skillSupportsPlatform(entry, platform ?? undefined))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function mergeOverlay(base, overlay) {
    if (!base)
        return overlay;
    const { origin: _origin, mcpReads: _mcpReads, operations: _operations, ...rest } = overlay;
    return {
        ...rest,
        contentDigest: createHash('sha256')
            .update(`${base.contentDigest ?? ''}:${overlay.contentDigest ?? ''}`)
            .digest('hex'),
        displayName: base.displayName,
        credentials: base.credentials,
        allowList: base.allowList,
        platform: base.platform,
        env: base.env,
        operations: base.operations,
        mcpReads: base.mcpReads
    };
}
const OVERLAY_DEFAULT_PLATFORMS = ['darwin', 'linux', 'win32', 'ios', 'android'];
async function loadRoot(skillsDir, origin) {
    let dirs;
    try {
        dirs = (await fs.promises.readdir(skillsDir, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }
    catch {
        return new Map();
    }
    const loaded = await Promise.all(dirs.map((dir) => loadEntry(skillsDir, dir, origin)));
    const byName = new Map();
    for (const entry of loaded) {
        if (entry) {
            byName.set(entry.name, entry);
        }
    }
    return byName;
}
export function mcpReadMethods(catalog) {
    const byHost = new Map();
    for (const entry of catalog) {
        if (entry.origin === 'overlay')
            continue;
        if (!entry.mcpReads || entry.mcpReads.length === 0)
            continue;
        for (const url of entry.allowList) {
            const host = hostnameOf(url);
            if (!host) {
                continue;
            }
            const methods = byHost.get(host) ?? new Set();
            for (const method of entry.mcpReads) {
                methods.add(method);
            }
            byHost.set(host, methods);
        }
    }
    return byHost;
}
function hostnameOf(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return null;
    }
}
export function detectPlatform() {
    return platform();
}
function platformsOf(declared, origin) {
    if (declared && declared.length > 0)
        return declared;
    return origin === 'overlay' ? OVERLAY_DEFAULT_PLATFORMS : [];
}
async function loadEntry(skillsDir, dir, origin) {
    try {
        const skillDir = path.join(skillsDir, dir);
        const raw = await fs.promises.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
        const { meta } = parseSkillFrontMatter(raw);
        const tools = meta.tools ?? [];
        const cli = await loadSkillCli(skillDir, tools);
        const referenceFiles = await loadReferenceFiles(skillDir);
        const contentHash = createHash('sha256').update(raw);
        for (const file of referenceFiles) {
            contentHash.update(file);
            contentHash.update(await fs.promises.readFile(path.join(skillDir, file)));
        }
        await hashSkillScripts(path.join(skillDir, 'scripts'), contentHash);
        const operations = origin === 'overlay' ? [] : await loadOperations(skillDir, dir);
        const platform = platformsOf(meta.platform, origin);
        return {
            name: dir,
            displayName: origin === 'overlay' ? undefined : meta.displayName || undefined,
            description: meta.description ?? '',
            contentDigest: contentHash.digest('hex'),
            aliases: meta.aliases,
            preloadOnName: meta.preloadOnName === false ? false : undefined,
            tools,
            credentials: meta.credentials ?? [],
            allowList: meta.allowList ?? [],
            mcpReads: meta.mcpReads,
            platform,
            requires: meta.requires,
            install: meta.install,
            setup: meta.setup,
            env: origin === 'overlay' ? undefined : meta.env,
            cliValidator: cli ? buildCliValidator(cli) : undefined,
            stub: meta.stub,
            minCapabilityProfile: meta.minCapabilityProfile || undefined,
            emoji: meta.emoji || undefined,
            referenceFiles: referenceFiles.length ? referenceFiles : undefined,
            operations: operations.length ? operations : undefined,
            origin
        };
    }
    catch {
        return null;
    }
}
async function loadOperations(skillDir, name) {
    let raw;
    try {
        raw = await fs.promises.readFile(path.join(skillDir, 'operations.json'), 'utf8');
    }
    catch {
        return [];
    }
    const operations = parseOperationsManifest(raw);
    if (!operations) {
        HarnessLog.warn('skill operations manifest rejected', { skill: name });
        return [];
    }
    return operations;
}
async function hashSkillScripts(directory, hash, prefix = 'scripts') {
    let entries;
    try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT') {
            return;
        }
        throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const file = path.join(directory, entry.name);
        const relative = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
            await hashSkillScripts(file, hash, relative);
        }
        else if (entry.isFile() && entry.name.endsWith('.py')) {
            hash.update(relative);
            hash.update(await fs.promises.readFile(file));
        }
    }
}
async function loadReferenceFiles(skillDir) {
    try {
        const entries = await fs.promises.readdir(path.join(skillDir, 'references'));
        return entries
            .filter((entry) => entry.endsWith('.md'))
            .sort()
            .map((entry) => `references/${entry}`);
    }
    catch {
        return [];
    }
}
