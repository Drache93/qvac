import fs from 'fs';
import { platform, totalmem } from 'os';
import process from 'process';
import ReadyResource from 'ready-resource';
import { HarnessError } from './lib/errors.js';
import { androidCpuPlacement } from './lib/hardware/cpu-placement.js';
import { probeGpuStats } from './lib/hardware/gpu-probe.js';
import { probeCapabilityProfile } from './lib/hardware/capability-probe.js';
import { Lifecycle } from './lib/lifecycle/index.js';
import { Policy } from './lib/policy/index.js';
import { didDrainTimeOut, raceDrain } from './lib/helpers/drain.js';
import { CompletionEngine } from './lib/capabilities/completion-engine/index.js';
import { imageSettingsFrom } from './lib/helpers/image-settings.js';
import { detectLanguage } from './lib/capabilities/detect-language.js';
import { invoke } from './lib/capabilities/invoke.js';
import { previewModelSource } from './lib/capabilities/preview-model-source.js';
import { expandImagePrompt } from './lib/capabilities/enhance.js';
import { download } from './lib/capabilities/download.js';
import { Embeddings } from './lib/embeddings/index.js';
import { deleteAllKvCaches, deleteKvCacheKey } from './lib/capabilities/kv-cache.js';
import { pushQueue } from './lib/queue.js';
import { AbortedError } from './lib/helpers/race-abort.js';
import { audioGenDownloadMetadata, categoryDownloadMetadata, customProjectionMap, defaultProjectionMap, catalogModelName, defaultVoiceModel, diffusionDownloadMetadata, infraModelsFor, modelNameToCapabilityProfile, residentSrc, setCustomModels } from './lib/models/model-catalog.js';
import { customModelRows, isModelSourceCached, mergeCustomRows, listModels } from './lib/models/model-list.js';
import { createDownloadGate } from './lib/models/download-gate.js';
import { deleteModelFiles, summarizeDelete } from './lib/models/model-delete.js';
import { createLoadTracker, createVoicePool, evictIdle, evictIdleWhere, isResident, leaseResidentModel, loadedModels, releaseModel, progressState } from './lib/models/model-pool.js';
import { openclCacheDir } from './lib/models/opencl-cache.js';
import { isSdkModelWedgedError } from './lib/models/sdk-faults.js';
import { createSdkLoader } from './lib/sdk-loader.js';
import { installAbortControllerPolyfill } from './lib/helpers/abort-polyfill.js';
import { Residency } from './lib/residency/index.js';
import { toolCatalog } from './lib/tools/catalog.js';
import { SkillsHost } from './lib/skills-host/index.js';
import { errorMessage, isRecord } from './lib/guards.js';
import { redactedRecoveryFields } from './lib/wire.js';
import { HarnessLog } from './lib/log.js';
import { installResolutionDetector, resolutionDetail } from './lib/resolution-detector.js';
import { bareRuntime } from './lib/tools/exec/bare-runtime.js';
import { runCommand } from './lib/tools/exec/runner.js';
import { createLocalRoots } from './lib/tools/fs/local.js';
import { createRemoteRoots } from './lib/tools/fs/remote.js';
export { CompletionEngine, ToolSets } from './lib/capabilities/completion-engine/index.js';
export const CONTEXT_OVERFLOW_MESSAGE = HarnessError.CONTEXT_OVERFLOW_MESSAGE;
export { imageSettingsFrom } from './lib/helpers/image-settings.js';
export { skillInContext, unreadySkillState } from './lib/capabilities/skill-entry.js';
export { toSdkTool } from './lib/capabilities/sdk-tool.js';
export { attachmentTurn, loadedSkillsFrom, skillLoadedTurn } from './lib/capabilities/tool-turns.js';
export { CAPABILITIES, isCapability } from './lib/capabilities/invoke.js';
export * from './lib/capabilities/download.js';
export * from './lib/models/model-catalog.js';
export * from './lib/models/model-list.js';
export { harnessChild, spawnHarness } from './lib/spawn.js';
export * from './lib/tools/skills/catalog.js';
export { requiredSettings, settingEnvName } from './lib/tools/skills/skill-settings.js';
export { TOOLSETS, toolsetEnabled } from './lib/tools/toolsets.js';
export { markCredentialRejected, markCredentialValid, recordCredentialHealth, resetAllCredentialHealth, resetCredentialHealth } from './lib/tools/skills/credential-health.js';
export { readSetup as normalizeSkillSetup } from './lib/tools/skills/manifest-parse.js';
export { isAvailableState, SKILL_STATE } from './lib/tools/skills/skill-state.js';
export { connectHarness, HARNESS_DIED, RemoteHarness } from './lib/connect.js';
export { serveHarness } from './lib/serve.js';
export { HarnessLog };
export const harnessLog = HarnessLog;
export const hlog = HarnessLog.info;
export const setHarnessLog = HarnessLog.enable;
export const setHarnessLogLevel = HarnessLog.setLevel;
export const setHarnessLogSink = HarnessLog.setSink;
import { HookPipeline } from './lib/hooks/index.js';
import { Agent } from './lib/agent/index.js';
export { HookPipeline };
export { Policy };
import { createGuardedFetch } from './lib/guarded-fetch.js';
import { PluginRegistry } from './lib/plugins/index.js';
import { createExecTool } from './lib/tools/exec.js';
import { canonicalDenyRoots, defaultRealpath, deniedRootsFor } from './lib/tools/fs/scope.js';
export const PLUGIN_API_VERSION = PluginRegistry.API_VERSION;
const SUSPEND_SETTLE_MS = 500;
const SPEECH_PLUGIN_MISSING = 'speech needs the speech plugin';
const KNOWLEDGE_PLUGIN_MISSING = 'knowledge needs the knowledge plugin';
const UNLOAD_FAILED = 'Runtime unload failed; close the harness before loading models again';
const HOST_SHELL = { name: 'host' };
function execOptions(exec) {
    if (!exec)
        return null;
    return exec === true ? {} : exec;
}
export class Harness extends ReadyResource {
    _hostTools;
    _tools;
    _capabilities = [];
    _sdk;
    _loads = createLoadTracker();
    _downloads;
    _hold;
    _residency;
    _embeddings;
    _voicePools = new Map();
    _skills;
    _lifecycle;
    _closeRetryNeeded = false;
    _modelsDir;
    _skillsDir;
    _exec;
    _deniedRoots;
    _policy;
    _shell;
    _projectionModel;
    _customProjection = {};
    _contextSize;
    _recentFits = new Map();
    _gpuStats;
    _capability = null;
    _capabilityInflight = null;
    _hostHooks;
    _hooks;
    _plugins;
    _pluginMode;
    _pluginsStarted = null;
    constructor({ tools = [], sdkLoader, skillsDir, modelsDir, sdkHome, exec, projectionModel, llmDevice, llmGpuLayers, contextSize, kvCacheK, kvCacheV, llmLoad, slots, embedDevice, embedGpuLayers, embedBatchSize, transcriptionDevice, completionModelCap, credentialStore, platform, gpuStats, hooks, plugins = [], pluginMode = 'frozen', policy } = {}) {
        super();
        this._exec = execOptions(exec);
        if (this._exec && tools.some((tool) => tool.name === PluginRegistry.EXEC_TOOL)) {
            throw new Error(`tools has '${PluginRegistry.EXEC_TOOL}', which the harness builds when exec is set`);
        }
        this._deniedRoots = sdkHome === undefined ? undefined : deniedRootsFor(sdkHome);
        this._policy = policy;
        this._plugins = new PluginRegistry(plugins, {
            services: { models: this._modelHost(transcriptionDevice), embed: this._embedHost() },
            exec: this._exec !== null,
            deniedRoots: this._deniedRoots ?? []
        });
        this._pluginMode = pluginMode;
        installAbortControllerPolyfill();
        this._hostHooks = Object.freeze([...(hooks ?? HookPipeline.defaults())]);
        this._hooks = this._hostHooks;
        this._sdk = sdkLoader ?? createSdkLoader();
        this._lifecycle = new Lifecycle({
            resource: this,
            sdk: { peek: () => this._sdk.peek() },
            loads: this._loads,
            releases: {
                pools: () => [
                    this._residency.destroy(),
                    this._embeddings.destroy(),
                    ...[...this._voicePools.values()].map((entry) => entry.pool.destroy())
                ],
                runtimes: () => [],
                plugins: () => this._plugins.unload()
            },
            models: () => loadedModels(this._residency.pool).map((entry) => entry.model),
            recreate: () => {
                this._residency.recreate();
                this._embeddings.recreate();
                for (const entry of this._voicePools.values()) {
                    entry.pool = this._createVoicePool(entry.spec);
                }
            },
            statusChanged: () => this._residency.invalidateStatus(),
            teardown: async () => {
                this._skills.close();
                await this._teardownPlugins();
            }
        });
        this._gpuStats = gpuStats;
        this._hostTools = tools;
        this._tools = tools;
        this._projectionModel = projectionModel ?? defaultProjectionMap();
        this._modelsDir = modelsDir;
        this._skillsDir = skillsDir;
        this._skills = new SkillsHost({
            skillsDir,
            platform,
            credentialStore,
            tools: () => this._tools,
            startPlugins: () => this._startPlugins()
        });
        this._downloads = createDownloadGate({
            isCached: (model, addon) => this._isModelCached(model, addon),
            onHeld: ({ model, addon }) => this._residency.notify({ status: 'held', model, addon }),
            onDropped: ({ model, addon }) => this._residency.notify({ status: 'error', model, addon, message: 'aborted' })
        });
        this._hold = (model, addon, signal) => this._downloads.hold(catalogModelName(model, addon), addon, signal);
        this._contextSize = contextSize;
        this._residency = new Residency({
            llmDevice,
            llmGpuLayers,
            contextSize,
            kvCacheK,
            kvCacheV,
            llmLoad,
            slots,
            completionModelCap,
            sdk: { load: () => this._sdk.load() },
            loads: this._loads,
            gate: this._lifecycle,
            hold: this._hold,
            capability: () => this.capability(),
            emit: (state) => this.emit('model', state),
            projectionFor: (model) => this._projectionFor(model),
            pools: () => [
                ...this._embeddings.pools(),
                ...[...this._voicePools.values()].map((entry) => entry.pool)
            ],
            poolFor: (addon, model) => {
                if (addon === 'embeddings') {
                    return this._embeddings.target(model);
                }
                const entry = this._voicePools.get(addon);
                if (!entry) {
                    throw new Error(SPEECH_PLUGIN_MISSING);
                }
                const key = residentSrc(model, addon);
                return {
                    pool: entry.pool,
                    key,
                    modelType: entry.spec.modelType,
                    needsRoom: entry.spec.needsRoom?.(key) ?? false,
                    open: () => entry.pool.open(key, key)
                };
            },
            embedRoom: (model, target) => this._embeddings.makeRoom(model, target),
            evictIdle: () => [
                ...this._embeddings.evictIdle(),
                ...[...this._voicePools.values()].map((entry) => evictIdle(entry.pool))
            ],
            unloadIdlePlugins: () => this._plugins.unloadIdle(),
            tools: () => this._tools,
            skills: (agentId, model) => this._skills.completionSkills(agentId, model)
        });
        this._embeddings = new Embeddings({
            device: embedDevice,
            gpuLayers: embedGpuLayers,
            batchSize: embedBatchSize,
            sdk: { loadEmbed: () => this._sdk.loadEmbed() },
            loads: this._loads,
            gate: this._lifecycle,
            notify: (state) => this._residency.notify(state),
            settleFit: (query) => this._residency.fit.settle(query),
            evictIdleChat: () => this._residency.evictIdleChat(),
            beforeLoad: (load) => this._residency.beforeLoad(load),
            hold: this._hold
        });
    }
    async _open() {
        try {
            installResolutionDetector(import.meta);
            await this._startPlugins();
            await this._loadAddons();
            await this._skills.open();
            HarnessLog.info('open', { skills: this._skills.names.length, tools: this._tools.length });
        }
        catch (error) {
            await this._teardownPlugins();
            throw error;
        }
    }
    _startPlugins() {
        this._pluginsStarted ??= this._runPluginStart();
        return this._pluginsStarted;
    }
    async _runPluginStart() {
        const reserved = this._hostTools.map((tool) => tool.name);
        if (this._exec) {
            reserved.push(PluginRegistry.EXEC_TOOL);
        }
        const started = await this._plugins.start([...reserved, Agent.TRANSFER_TOOL_NAME, Agent.DELEGATE_TOOL_NAME], {
            fetch: (signal, mayConnect) => createGuardedFetch({ signal, mayConnect }),
            publish: (swapped) => this._publishPlugins(swapped)
        });
        this._publishPlugins(started);
    }
    _publishPlugins({ tools, capabilities, hooks, skills, exec }) {
        const pre = hooks.filter((hook) => hook.phase === 'preToolCall');
        const rest = hooks.filter((hook) => hook.phase !== 'preToolCall');
        this._tools = Object.freeze([...this._hostTools, ...this._execTools(exec), ...tools]);
        this._shell = exec.shell;
        this._capabilities = Object.freeze(capabilities);
        this._hooks = Object.freeze([...pre, ...this._hostHooks, ...rest]);
        this._skills.publish(skills);
    }
    _execTools(exec) {
        if (!this._exec) {
            return [];
        }
        return [
            createExecTool({
                ...this._exec,
                ...exec,
                deniedRoots: this._deniedRoots,
                skillsDir: this._skillsDir,
                skillSettings: (skill, agentId) => this._skills.skillSettings(skill, agentId),
                skillEnv: (skill) => this._skills.skillEnv(skill)
            })
        ];
    }
    async addPlugin(plugin) {
        await this._dynamicPlugins();
        await this._plugins.add(plugin);
    }
    async removePlugin(name) {
        await this._dynamicPlugins();
        await this._plugins.remove(name);
    }
    async reloadPlugin(name, plugin) {
        await this._dynamicPlugins();
        await this._plugins.reload(name, plugin);
    }
    async _dynamicPlugins() {
        if (this._pluginMode !== 'dynamic') {
            throw new Error("plugins are frozen: construct the harness with pluginMode 'dynamic'");
        }
        if (!this.opened)
            await this.ready();
        this._lifecycle.assertNotClosing();
    }
    _modelHost(transcriptionDevice) {
        return {
            transcriptionDevice,
            sdk: () => this._sdk.load(),
            track: (load, sdk) => this._loads.track(load, sdk),
            makeRoom: (signal, busy, srcs) => this._residency.makeRoomForPlugin(signal, busy, srcs),
            hold: this._hold,
            completionModel: (model, signal) => this._residency.borrow(model, signal),
            emit: (state) => this.emit('model', state),
            progressState,
            statusChanged: () => this._residency.statusChanged(),
            registerPool: (spec) => this._registerPool(spec),
            enterWork: () => {
                if (this._lifecycle.suspended) {
                    throw new HarnessError('HARNESS_SUSPENDED');
                }
                return this._lifecycle.enterWork();
            }
        };
    }
    _registerPool(spec) {
        const entry = { spec, pool: this._createVoicePool(spec) };
        this._voicePools.set(spec.addon, entry);
        return {
            open: (model) => {
                const pool = entry.pool;
                const handle = pool.open(model, model);
                return {
                    load: async () => {
                        const { modelId } = await handle.load();
                        this._lifecycle.assertNotClosing();
                        return { modelId };
                    },
                    peek: () => handle.peek(),
                    release: () => releaseModel(pool, model)
                };
            },
            resident: (model) => isResident(entry.pool, model),
            evictIdle: (wanted) => evictIdleWhere(entry.pool, wanted)
        };
    }
    _createVoicePool({ sdk, label, openclCache, ...spec }) {
        return createVoicePool(() => sdk(), (state) => this._residency.notify(label ? { ...state, model: label } : state), {
            ...spec,
            openclCacheDir: openclCache ? openclCacheDir : undefined,
            loads: this._loads,
            onUnloadFailure: (modelId, error) => this._lifecycle.recordModelUnloadFailure(modelId, error),
            beforeLoad: (load) => this._residency.beforeLoad(load),
            hold: this._hold
        });
    }
    _embedHost() {
        return {
            embed: (request) => this.embed(request),
            sdk: () => this._sdk.loadEmbed()
        };
    }
    async _loadAddons() {
        await Promise.all([
            PluginRegistry.loadAddons('the harness', this._sdk.addons),
            ...this._tools.map((tool) => PluginRegistry.loadAddons(`tool '${tool.name}'`, tool.addons))
        ]);
    }
    _teardownPlugins() {
        return this._plugins.teardown((plugin, error) => HarnessLog.info('plugin teardown failed', { plugin, err: errorMessage(error) }));
    }
    get suspended() {
        return this._lifecycle.suspended;
    }
    get skillNames() {
        return this._skills.names;
    }
    setCredentials(entries) {
        this._skills.setCredentials(entries);
    }
    setSkillSettings(entries) {
        this._skills.setSkillSettings(entries);
    }
    skillSettings(skill, agentId) {
        return this._skills.skillSettings(skill, agentId);
    }
    listManagedSkills() {
        return this._skills.listManagedSkills();
    }
    readSkillFile(name) {
        return this._skills.readSkillFile(name);
    }
    writeSkillFile(name, content) {
        return this._skills.writeSkillFile(name, content);
    }
    copyBaseForEdit(name) {
        return this._skills.copyBaseForEdit(name);
    }
    deleteOverlaySkill(name) {
        return this._skills.deleteOverlaySkill(name);
    }
    resolveCredential(key, ctx) {
        return this._skills.resolveCredential(key, ctx);
    }
    async skills(agentId, modelName, options) {
        if (!this.opened)
            await this.ready();
        this._lifecycle.assertNotClosing();
        return this._skills.statuses(agentId, modelName, options);
    }
    async tools() {
        if (!this.opened)
            await this.ready();
        return toolCatalog(this._tools);
    }
    get toolNames() {
        return this._tools.map((tool) => tool.name);
    }
    get supportsImages() {
        if (!this._projectionModel)
            return false;
        if (typeof this._projectionModel === 'string')
            return true;
        return Object.keys(this._projectionModel).length > 0;
    }
    supportsImagesFor(model) {
        return Boolean(this._projectionFor(model));
    }
    _projectionFor(model) {
        const custom = this._customProjection[model];
        if (custom) {
            return custom;
        }
        const projection = this._projectionModel;
        if (!projection) {
            return undefined;
        }
        return typeof projection === 'string' ? projection : projection[model];
    }
    setCustomModels(entries) {
        setCustomModels(entries);
        this._customProjection = customProjectionMap();
    }
    setModelIdleTimeout(ms) {
        this._residency.setIdleTimeout(ms);
    }
    async setModelMemoryCap(percent) {
        await this._residency.setMemoryCap(percent);
    }
    async memoryUsage() {
        return { usedBytes: this._residency.settledBytes() };
    }
    setDownloadsAllowed({ allowed }) {
        this._downloads.setAllowed(allowed);
    }
    async _isModelCached(model, addon) {
        const row = (await this.list({ type: addon })).find((entry) => entry.name === model);
        if (row) {
            return row.isCached;
        }
        const sdk = await this._sdk.load();
        return isModelSourceCached(sdk, { model, addon, modelsDir: this._modelsDir });
    }
    previewModelSource(context) {
        return previewModelSource(context, {
            assessFit: (query) => this._residency.fit.assess(query),
            contextSize: this._contextSize,
            recentFits: this._recentFits
        });
    }
    async describe() {
        if (!this.opened)
            await this.ready();
        return {
            toolNames: this.toolNames,
            skills: this._skills.names,
            supportsImages: this.supportsImages,
            supportsKvCacheDeletion: true
        };
    }
    diagnostics() {
        return {
            models: this.opened ? this._residency.loaded() : [],
            suspended: this.suspended,
            sdkLoaded: this._sdk.peek() !== null,
            toolNames: this.toolNames,
            skills: this._skills.names,
            device: this._residency.deviceConfig().device
        };
    }
    getEmbeddingDevice() {
        return this._embeddings.device;
    }
    setEmbeddingDevice(device) {
        return this._embeddings.setDevice(device);
    }
    async presuspend() {
        await this._lifecycle.send('PRESUSPEND', { open: false });
    }
    async suspend() {
        this._downloads.abandon();
        const result = await raceDrain(this._lifecycle.send('SUSPEND'), SUSPEND_SETTLE_MS);
        if (didDrainTimeOut(result)) {
            throw new Error('Harness suspend is still waiting for active work to settle');
        }
    }
    async resume() {
        await this._lifecycle.send('RESUME');
    }
    async wakeup() {
        await this._lifecycle.send('WAKEUP');
    }
    ready() {
        if (this._lifecycle.closeRequested || this.closing || this.closed) {
            return Promise.reject(new HarnessError('HARNESS_CLOSING'));
        }
        return super.ready();
    }
    async _close() {
        HarnessLog.info('closing');
        this._residency.closeIdle();
        this._downloads.abandon();
        await this._lifecycle.close();
    }
    close() {
        this._lifecycle.requestClose();
        if (this._closeRetryNeeded) {
            this.closing = null;
            this._closeRetryNeeded = false;
        }
        const pending = !this.opened && this.opening !== null ? this._closeWhileOpening() : super.close();
        void pending.catch(() => {
            if (this.closing === pending) {
                this._closeRetryNeeded = true;
            }
        });
        const bounded = raceDrain(pending).then((result) => {
            if (didDrainTimeOut(result)) {
                throw new Error('Harness close is still waiting for active work to settle');
            }
        });
        void bounded.catch(noop);
        return bounded;
    }
    _closeWhileOpening() {
        if (this.closing)
            return this.closing;
        const opening = this.opening;
        const pluginsClosing = this._teardownPlugins();
        const pending = (async () => {
            await opening?.catch(noop);
            await pluginsClosing;
            this._lifecycle.abortCompletions();
            this._loads.drain();
            await this._lifecycle.finishClose();
            this.closed = true;
            this.emit('close');
        })();
        this.closing = pending;
        return pending;
    }
    download(args) {
        this._lifecycle.assertNotClosing();
        let releaseWork = null;
        const projection = (args.addon ?? 'llm') === 'llm' ? this._projectionFor(args.model) : undefined;
        const multiFile = diffusionDownloadMetadata(args.model, args.addon) ??
            audioGenDownloadMetadata(args.model, args.addon) ??
            categoryDownloadMetadata(args.model, args.addon);
        return download(async () => {
            if (!this.opened)
                await this.ready();
            releaseWork = this._lifecycle.enterWork();
            try {
                const sdk = await this._sdk.load();
                this._lifecycle.assertNotClosing();
                return sdk;
            }
            catch (error) {
                releaseWork?.();
                releaseWork = null;
                throw error;
            }
        }, {
            ...args,
            projection,
            companions: multiFile?.companions,
            assetSizes: multiFile?.assetSizes
        }, (event) => {
            this._residency.invalidateStatus();
            if (event.type === 'complete') {
                this._downloads.downloaded();
            }
        }, () => {
            releaseWork?.();
            releaseWork = null;
        });
    }
    embed(context) {
        return this._residency.busy(() => this._embeddings.embed(context));
    }
    async _speechService() {
        if (!this.opened)
            await this.ready();
        if (!this._plugins.ctx.speech) {
            throw new Error(SPEECH_PLUGIN_MISSING);
        }
        return this._plugins.ctx.speech;
    }
    async _knowledgeService() {
        if (!this.opened)
            await this.ready();
        if (!this._plugins.ctx.knowledge) {
            throw new Error(KNOWLEDGE_PLUGIN_MISSING);
        }
        return this._plugins.ctx.knowledge;
    }
    async knowledgeUpsert(artifact) {
        return (await this._knowledgeService()).upsert(artifact);
    }
    async knowledgeRemove(artifactId) {
        return (await this._knowledgeService()).remove(artifactId);
    }
    async knowledgeSearch(query) {
        return (await this._knowledgeService()).search(query);
    }
    async knowledgeStatus() {
        return (await this._knowledgeService()).status();
    }
    transcribe(context) {
        return this._residency.busy(() => this._transcribe(context));
    }
    async _transcribe({ model, audio, signal }) {
        const speech = await this._speechService();
        return speech.transcribe({
            model: model || defaultVoiceModel('transcription'),
            audio,
            signal
        });
    }
    detectLanguage(context) {
        return detectLanguage(context);
    }
    speak(context) {
        return this._residency.busy(() => this._speak(context));
    }
    async _speak({ model, text, signal }) {
        const speech = await this._speechService();
        return speech.speak({ model: model || (await this._defaultTts(speech)), text, signal });
    }
    speakStream(context) {
        return this._residency.busyStream(() => this._speakStream(context));
    }
    async *_speakStream({ model, text, signal }) {
        const speech = await this._speechService();
        yield* speech.speakStream({ model: model || (await this._defaultTts(speech)), text, signal });
    }
    async _defaultTts(speech) {
        const profile = await this.capability().then((capability) => capability.capabilityProfile, () => null);
        return speech.defaultModel(profile);
    }
    async list(options = {}) {
        if (!this.opened)
            await this.ready();
        const releaseWork = this._lifecycle.enterWork();
        try {
            const sdk = await this._sdk.load();
            this._lifecycle.assertNotClosing();
            const rows = await listModels(sdk, options, {
                cache: this._residency.status,
                projectionFor: (name) => this._projectionFor(name)
            });
            const loaded = this._residency.settled();
            const loading = this._residency.loading();
            const custom = await customModelRows(options, { modelsDir: this._modelsDir, loaded });
            const merged = mergeCustomRows(rows, custom);
            const fits = await this._residency.rowFits(merged);
            const memory = this._residency.memoryByModel();
            return merged.map((row) => {
                const fit = row.isLoaded || loaded.has(row.name) ? undefined : fits.get(row.registryPath);
                return {
                    ...row,
                    isLoading: loading.has(row.name),
                    memoryBytes: memory.get(row.name) ?? memory.get(residentSrc(row.name, row.type)),
                    fit: fit?.verdict,
                    fitBasis: fit?.basis,
                    fitEvidence: fit?.evidence
                };
            });
        }
        finally {
            releaseWork();
        }
    }
    async deleteModel(name) {
        if (!this.opened)
            await this.ready();
        const releaseWork = this._lifecycle.enterWork();
        try {
            const sdk = await this._sdk.load();
            this._lifecycle.assertNotClosing();
            const result = await deleteModelFiles(sdk, name, { modelsDir: this._modelsDir });
            this._residency.invalidateStatus();
            return summarizeDelete(result);
        }
        finally {
            releaseWork();
        }
    }
    async clearKvCache() {
        if (!this.opened)
            await this.ready();
        const releaseWork = this._lifecycle.enterWork();
        try {
            return await deleteAllKvCaches(() => {
                this._lifecycle.assertNotClosing();
                return this._sdk.load();
            });
        }
        finally {
            releaseWork();
        }
    }
    async deleteKvCache(kvCacheKey) {
        if (!this.opened)
            await this.ready();
        const releaseWork = this._lifecycle.enterWork();
        try {
            return await deleteKvCacheKey(() => {
                this._lifecycle.assertNotClosing();
                return this._sdk.load();
            }, kvCacheKey);
        }
        finally {
            releaseWork();
        }
    }
    async infraModels(profile) {
        return infraModelsFor(profile);
    }
    async capability() {
        if (!this.opened)
            await this.ready();
        this._lifecycle.assertNotClosing();
        if (this._capability) {
            return this._capability;
        }
        if (this._capabilityInflight) {
            return this._capabilityInflight;
        }
        const reads = {
            totalmem,
            platform,
            readFile: async (path) => {
                try {
                    return String(await fs.promises.readFile(path, 'utf8'));
                }
                catch {
                    return null;
                }
            },
            run: async (command) => {
                try {
                    const runtime = await bareRuntime();
                    const result = await runCommand(command, { ...runtime, timeoutMs: 5_000 });
                    return result.exitCode === 0 ? result.stdout : null;
                }
                catch {
                    return null;
                }
            },
            readGpuStats: () => (this._gpuStats !== undefined ? this._gpuStats : probeGpuStats())
        };
        this._capabilityInflight = probeCapabilityProfile(reads)
            .then((capability) => {
            capability = { ...capability, hostRunLog: true, hostRunLogVersion: 1 };
            this._capability = capability;
            return capability;
        })
            .finally(() => {
            this._capabilityInflight = null;
        });
        return this._capabilityInflight;
    }
    warmModel(context) {
        return this._residency.busy(() => this._residency.warm(context));
    }
    loadModel(context) {
        return this._residency.busy(() => this._residency.load(context));
    }
    unloadModel(context) {
        return this._residency.busy(() => this._residency.unload(context));
    }
    invoke(context) {
        return this._residency.busyStream(() => this._invoke(context));
    }
    async *_invoke({ capability, args, enhance, agent, attach, fetchAttachment, progress, signal }) {
        if (!this.opened)
            await this.ready();
        if (this.suspended) {
            this._lifecycle.assertNotClosing();
            return yield { type: 'aborted' };
        }
        const releaseWork = this._lifecycle.enterWork();
        HarnessLog.info('invoke start', { capability, enhance });
        try {
            yield* invoke({
                capability,
                args,
                enhance,
                enhancer: this._residentEnhancer(),
                tools: [...this._tools, ...this._capabilities],
                ctx: {
                    image: imageSettingsFrom(agent),
                    attach,
                    fetchAttachment,
                    progress,
                    signal
                }
            });
        }
        finally {
            HarnessLog.info('invoke end', { capability });
            releaseWork();
        }
    }
    completion(context) {
        if (!context.agents) {
            const { hopLog, ...run } = context;
            return this._completion({ ...run, ...hopLog?.({ index: 0, agent: run.agent?.id ?? '' }) });
        }
        if (context.boot || context.onStep) {
            throw new TypeError('A run that follows handoffs cannot take boot or onStep; give it a hopLog, or run it over the wire with a HostRunLog');
        }
        return Agent.follow({ completion: (hop) => this._completion(hop) }, { ...context, goal: undefined });
    }
    async serveModelRound(request, io) {
        if (!this.opened)
            await this.ready();
        this._lifecycle.assertNotClosing();
        if (this.suspended || this._lifecycle.draining) {
            throw new HarnessError('HARNESS_SUSPENDED');
        }
        if (this._lifecycle.unloadFailed) {
            throw new Error(UNLOAD_FAILED);
        }
        const { modelId } = request;
        const { key, acquireRound } = this._residency.servedRound(modelId);
        let served;
        const round = this._lifecycle.trackCompletion((signal) => this._residency.busyStream(async function* () {
            served = await CompletionEngine.serveModelRound(request, { signal, emit: (event) => io.emit(event), retake: () => io.retake() }, { acquireRound });
        }), io.signal);
        try {
            await round.next();
        }
        catch (err) {
            throw await this._servedRoundFailed(err, modelId, key);
        }
        if (!served) {
            throw new Error('A served round ended without its result');
        }
        this._residency.clearFaults(modelId);
        return served;
    }
    async _servedRoundFailed(err, model, key) {
        const aborted = err instanceof AbortedError || this.suspended || this._lifecycle.draining;
        if (aborted || !isSdkModelWedgedError(err)) {
            return err;
        }
        const wedged = await this._residency.evictWedged(model, key);
        if (wedged.fatal) {
            setTimeout(() => process.exit(1), 0);
        }
        return new Error(wedged.message, { cause: err });
    }
    _completion(context) {
        this._lifecycle.assertNotClosing();
        if (this._lifecycle.draining) {
            throw new HarnessError('HARNESS_SUSPENDED');
        }
        if (this._lifecycle.unloadFailed) {
            throw new Error(UNLOAD_FAILED);
        }
        return this._lifecycle.trackCompletion((signal) => this._residency.busyStream(() => this._runCompletion({ ...context, signal })), context.signal);
    }
    async *_runCompletion(request) {
        if (!this.opened)
            await this.ready();
        this._lifecycle.assertNotClosing();
        if (this.suspended || this._lifecycle.draining) {
            yield { type: 'aborted' };
            return;
        }
        const { boot, onStep, hostAppendTimeoutMs, requestDigestKey, ...provided } = request;
        let modelId = request.model ?? '';
        let key = null;
        const releasePlugins = await this._plugins.hold(request.parentRunId !== undefined);
        const detached = [];
        try {
            const runtime = async (run) => {
                modelId = run.model ?? run.modelId;
                const runContext = { ...run, model: run.model ?? run.modelId };
                const lease = await this._residency.completionRuntime(runContext);
                const access = await this._access(run, lease.args);
                if (!key) {
                    this._residency.reply(lease.key);
                }
                key = lease.key;
                return { ...lease, args: { ...lease.args, access }, services: this._plugins.ctx };
            };
            const args = { ...provided, lockOwner: this };
            for await (const event of CompletionEngine.run(runtime, args, {
                hooks: this._hooks,
                boot,
                onStep,
                hostAppendTimeoutMs,
                requestDigestKey,
                resumeRequest: provided,
                onDetached: (pending, runId) => {
                    detached.push(pending);
                    this._lifecycle.trackDetachedRun(pending, runId);
                }
            })) {
                yield event;
            }
            if (key) {
                this._residency.clearFaults(modelId);
            }
        }
        catch (error) {
            yield* this._completionFailed(error, modelId, key);
        }
        finally {
            if (key) {
                HarnessLog.info('completion end', { model: modelId });
                this._residency.replied(key);
                void this._plugins.unloadIdle();
            }
            void Promise.allSettled(detached).then(releasePlugins);
        }
    }
    async _access(run, roots) {
        const layers = [this._policy, run.agent?.policy, run.policy];
        return Policy.forRun(await Promise.all(layers.map(canonicalPolicy)), { ...roots, deny: await canonicalDenyRoots(this._deniedRoots, defaultRealpath) }, this._providers());
    }
    _providers() {
        const providers = [];
        if (this._exec) {
            providers.push(this._shell ?? HOST_SHELL);
        }
        const ctx = this._plugins.ctx;
        if ('sandbox' in ctx) {
            providers.push(ctx.sandbox);
        }
        return providers;
    }
    async *_completionFailed(err, model, key) {
        if (err instanceof AbortedError || this.suspended || this._lifecycle.draining) {
            HarnessLog.info('completion aborted', {
                model,
                suspended: this.suspended || this._lifecycle.draining
            });
            yield { type: 'aborted' };
            return;
        }
        const message = errorMessage(err);
        const name = err instanceof Error ? err.name : undefined;
        HarnessLog.error('completion failed', { model, ...resolutionDetail(err), err: message });
        if (key && isSdkModelWedgedError(err)) {
            const wedged = await this._residency.evictWedged(model, key);
            yield completionErrorEvent(wedged.message, name, err);
            if (wedged.fatal) {
                process.exit(1);
            }
        }
        else {
            yield completionErrorEvent(message, name, err);
        }
    }
    _residentEnhancer() {
        return async (prompt, signal) => {
            const lease = await leaseResidentModel(this._residency.pool, (model) => !this._residency.borrowed(model));
            if (!lease) {
                return null;
            }
            try {
                const sdk = await this._sdk.load();
                return await expandImagePrompt(sdk, prompt, {
                    modelId: lease.modelId,
                    model: lease.model,
                    signal
                });
            }
            catch (err) {
                HarnessLog.warn('enhance failed', { err: errorMessage(err) });
                return null;
            }
            finally {
                lease.release();
            }
        };
    }
}
function completionErrorEvent(message, name, error) {
    const event = { type: 'error', message, ...completionErrorDetails(error) };
    if (name) {
        event.name = name;
    }
    return event;
}
function completionErrorDetails(error) {
    if (!isRecord(error))
        return {};
    if (error.code === 'PENDING_ARGS_REDACTED') {
        return { code: 'PENDING_ARGS_REDACTED', ...redactedRecoveryFields(error) };
    }
    if (error.name !== 'RunIncompatible') {
        return {};
    }
    const match = errorMessage(error).match(/^Incompatible run log: (machine|log|xstate) version (\d{1,10}(?:\.\d{1,10}){0,3}(?:-[A-Za-z0-9.-]{1,16})?) \(expected (\d{1,10}(?:\.\d{1,10}){0,3}(?:-[A-Za-z0-9.-]{1,16})?)\)/);
    if (!match) {
        return {};
    }
    const kind = match[1];
    const found = match[2];
    const expected = match[3];
    if ((kind !== 'machine' && kind !== 'log' && kind !== 'xstate') || !found || !expected) {
        return {};
    }
    return { kind, found, expected };
}
function noop() { }
async function canonicalPolicy(policy) {
    if (!policy) {
        return undefined;
    }
    const { files = {}, sockets } = policy;
    return {
        ...policy,
        files: {
            read: files.read === 'all' ? 'all' : await canonicalRoots(files.read),
            write: await canonicalRoots(files.write),
            deny: await canonicalRoots(files.deny)
        },
        sockets: await canonicalRoots(sockets)
    };
}
async function canonicalRoots(roots) {
    return roots && canonicalDenyRoots(roots, defaultRealpath);
}
