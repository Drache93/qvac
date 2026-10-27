import process from 'process';
import { HarnessError } from '../errors.js';
import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
import { modelNameToCapabilityProfile } from '../models/model-catalog.js';
import { probeBinVersions } from '../tools/skills/bin-check.js';
import { ensureBundledSkillsDir } from '../tools/skills/bundled-dir.js';
import { availableSkills, detectPlatform, loadSkillCatalog, resolveSkillStatuses, skillSupportsPlatform, versionProbeSkills } from '../tools/skills/catalog.js';
import { resetCredentialHealth } from '../tools/skills/credential-health.js';
import { ensureSkillsOverlayDir } from '../tools/skills/overlay-dir.js';
import { copyBaseForEdit, deleteOverlaySkill, listManagedSkills, readSkillFile, writeSkillFile } from '../tools/skills/overlay-crud.js';
import { watchSkillsOverlay } from '../tools/skills/overlay-watch.js';
import { deviceSharedKeys, scopeKey } from '../tools/skills/scope-key.js';
import { settingsScopeKey } from '../tools/skills/skill-settings.js';
import { bareRuntime } from '../tools/exec/bare-runtime.js';
import { runCommand } from '../tools/exec/runner.js';
export class SkillsHost {
    static BIN_VERSION_PROBE_TTL_MS = 45_000;
    _skillsDir;
    _platform;
    _credentialStore;
    _tools;
    _startPlugins;
    _watcher = null;
    _allSkills = [];
    _supportedSkills = [];
    _credentials = new Map();
    _settings = new Map();
    _readiness = new Map();
    _deviceSharedKeys = null;
    _binVersionCache = null;
    _binVersionInflight = null;
    constructor(opts) {
        this._skillsDir = opts.skillsDir;
        this._platform = opts.platform;
        this._credentialStore = opts.credentialStore;
        this._tools = opts.tools;
        this._startPlugins = opts.startPlugins;
    }
    get names() {
        return this._supportedSkills.map((skill) => skill.name);
    }
    async open() {
        await this._reload();
        await this._watch();
    }
    close() {
        this._watcher?.stop();
        this._watcher = null;
    }
    publish(skills) {
        this._readiness = new Map(skills.map((readiness) => [readiness.skill, readiness]));
        this._deviceSharedKeys = deviceSharedKeys(skills);
        this._filter();
    }
    setCredentials(entries) {
        const previous = this._credentials;
        const next = new Map();
        for (const { key, token, expiresAt, agentId, skill } of entries) {
            if (!token)
                continue;
            const storeKey = scopeKey({ agentId, skill, key });
            const record = typeof expiresAt === 'number' && expiresAt > 0 ? { token, expiresAt } : { token };
            const current = previous.get(storeKey);
            if (!current || current.token !== record.token || current.expiresAt !== record.expiresAt) {
                resetCredentialHealth(key, agentId, skill);
            }
            next.set(storeKey, record);
        }
        this._credentials = next;
    }
    setSkillSettings(entries) {
        const next = new Map();
        for (const { skill, key, value, agentId } of entries) {
            if (!skill || !key || typeof value !== 'string')
                continue;
            const scope = settingsScopeKey(skill, agentId);
            const bucket = next.get(scope) ?? {};
            bucket[key] = value;
            next.set(scope, bucket);
        }
        this._settings = next;
    }
    skillSettings(skill, agentId) {
        return {
            ...this._settings.get(settingsScopeKey(skill, null)),
            ...(agentId ? this._settings.get(settingsScopeKey(skill, agentId)) : undefined)
        };
    }
    skillEnv(skill) {
        return this._allSkills.find((entry) => entry.name === skill)?.env;
    }
    async listManagedSkills() {
        return listManagedSkills(await this._baseDir(), await ensureSkillsOverlayDir());
    }
    async readSkillFile(name) {
        return readSkillFile(await this._baseDir(), await ensureSkillsOverlayDir(), name);
    }
    async writeSkillFile(name, content) {
        const overlay = await this._overlayDir();
        await writeSkillFile(overlay, name, content);
        await this._reload();
        return { ok: true };
    }
    async copyBaseForEdit(name) {
        const overlay = await this._overlayDir();
        const result = await copyBaseForEdit(await this._baseDir(), overlay, name);
        if (result.copied) {
            await this._reload();
        }
        return result;
    }
    async deleteOverlaySkill(name) {
        const overlay = await this._overlayDir();
        const result = await deleteOverlaySkill(overlay, name);
        if (result.removed) {
            await this._reload();
        }
        return result;
    }
    resolveCredential(key, ctx) {
        if (this._credentialStore) {
            return this._credentialStore(key, ctx);
        }
        const agentId = ctx?.agentId ?? null;
        if (agentId && !this._deviceSharedKeys) {
            return this._startPlugins().then(() => this.resolveCredential(key, ctx));
        }
        const deviceShared = this._deviceSharedKeys?.has(key) === true;
        for (const skill of ctx?.skills ?? []) {
            const owned = this._credentials.get(scopeKey({ agentId, skill, key })) ??
                (agentId && deviceShared ? this._credentials.get(scopeKey({ skill, key })) : undefined);
            if (owned) {
                return owned;
            }
        }
        if (agentId) {
            const scoped = this._credentials.get(scopeKey({ agentId, key }));
            if (scoped) {
                return scoped;
            }
        }
        if (!agentId || deviceShared) {
            return this._credentials.get(scopeKey({ key })) ?? null;
        }
        return null;
    }
    async statuses(agentId, modelName, options) {
        const platform = this._currentPlatform();
        const refresh = options?.refresh === true;
        return resolveSkillStatuses(this._allSkills, {
            installedTools: this._installedTools(),
            credentialStore: (key, ctx) => this.resolveCredential(key, ctx),
            settingsStore: (skill, agentId) => this.skillSettings(skill, agentId),
            platform,
            agentId,
            binVersions: options?.skipBinProbe === true
                ? (this._binVersionCache?.bySkill ?? new Map())
                : await this._probeBinVersions(platform, refresh),
            refresh,
            skipCredentialProbe: options?.skipCredentialProbe === true,
            activeProfile: modelName ? modelNameToCapabilityProfile(modelName) : undefined,
            readiness: this._readiness
        });
    }
    async completionSkills(agentId, model) {
        const statuses = new Map((await this.statuses(agentId, model, { skipCredentialProbe: true, skipBinProbe: true })).map((entry) => [entry.name, entry.status]));
        return availableSkills(this._supportedSkills, this._installedTools()).map((entry) => ({
            ...entry,
            status: statuses.get(entry.name)
        }));
    }
    _currentPlatform() {
        return this._platform ?? detectPlatform();
    }
    _installedTools() {
        return new Set(this._tools().map((tool) => tool.name));
    }
    async _baseDir() {
        return this._skillsDir ?? (await ensureBundledSkillsDir());
    }
    async _overlayDir() {
        const overlay = await ensureSkillsOverlayDir();
        if (!overlay) {
            throw new HarnessError('NO_SKILLS_OVERLAY');
        }
        return overlay;
    }
    async _reload() {
        this._allSkills = await loadSkillCatalog(await this._baseDir(), { platform: null });
        this._filter();
    }
    _filter() {
        const platform = this._currentPlatform();
        const supported = this._allSkills.filter((skill) => skillSupportsPlatform(skill, platform));
        this._supportedSkills = availableSkills(supported, this._installedTools());
    }
    async _watch() {
        if (this._watcher)
            return;
        try {
            const overlay = await ensureSkillsOverlayDir();
            if (!overlay) {
                return;
            }
            this._watcher = watchSkillsOverlay(overlay, () => {
                this._reload().catch((err) => HarnessLog.warn('overlay reload failed', { err: errorMessage(err) }));
            });
        }
        catch (err) {
            HarnessLog.warn('overlay watch unavailable', { err: errorMessage(err) });
        }
    }
    async _probeBinVersions(platform, refresh) {
        const now = Date.now();
        if (!refresh && this._binVersionCache && this._binVersionCache.expiresAt > now) {
            return this._binVersionCache.bySkill;
        }
        if (this._binVersionInflight) {
            return this._binVersionInflight;
        }
        this._binVersionInflight = this._runBinVersionProbes(platform)
            .then((bySkill) => {
            this._binVersionCache = {
                expiresAt: Date.now() + SkillsHost.BIN_VERSION_PROBE_TTL_MS,
                bySkill
            };
            return bySkill;
        })
            .finally(() => {
            this._binVersionInflight = null;
        });
        return this._binVersionInflight;
    }
    async _runBinVersionProbes(platform) {
        if (process.env.QVAC_NO_SKILL_BIN_PROBE) {
            return new Map();
        }
        const candidates = versionProbeSkills(this._allSkills, {
            installedTools: this._installedTools(),
            platform,
            readiness: this._readiness
        });
        if (candidates.length === 0) {
            return new Map();
        }
        let runtime;
        try {
            runtime = await bareRuntime();
        }
        catch {
            return new Map();
        }
        const run = async (command) => {
            try {
                const result = await runCommand(command, { ...runtime, timeoutMs: 5_000 });
                return result.exitCode === 0 ? result.stdout : null;
            }
            catch {
                return null;
            }
        };
        const bySkill = new Map();
        for (const skill of candidates) {
            const states = await probeBinVersions(skill.requires, { platform, run });
            if (states.size > 0) {
                bySkill.set(skill.name, states);
            }
        }
        return bySkill;
    }
}
