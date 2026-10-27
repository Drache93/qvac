import ScopeLock from 'scope-lock';
import { HarnessError } from '../errors.js';
import { errorMessage, isRecord } from '../guards.js';
import { AbortedError, raceAbort } from '../helpers/race-abort.js';
import { HarnessLog } from '../log.js';
import { ContextChoice as ContextClimb } from '../models/context-choice.js';
import { parseGgufHeader, readGgufHeaderBytes } from '../models/gguf-header.js';
import { resolveMainGpu } from '../models/gpu-selection.js';
import { createIdleReaper } from '../models/idle-unload.js';
import { memoryCapBytes, nextVictim, VictimRank } from '../models/memory-cap.js';
import { assetBytes, curatedListables, curatedModelAsset, customContextLength, customModelSrc, modelAddonOf } from '../models/model-catalog.js';
import { ModelFit } from '../models/model-fit.js';
import { createModelStatusCache, invalidateModelStatusCache } from '../models/model-list.js';
import { awaitModelCapacity, contextSize, slotCount, createModelPool, evictIdle, evictIdleWhere, evictIdleWithin, evictModel, evictModelWithin, isResident, leaseCount, loadedModels, loadingModels, modelKey, modelOf, releaseModel, resolveLoadOptions, settledEntries, settledModels } from '../models/model-pool.js';
import { openclCacheDir } from '../models/opencl-cache.js';
import { prepareCompletionRuntime, roundAcquirer } from './completion-runtime.js';
const PLUGIN_EVICT_WAIT_MS = 15_000;
const WEDGED_EVICT_WAIT_MS = 10_000;
const MODEL_ROOM_WAIT_MS = 300_000;
const WARM_ROOM_WAIT_MS = 2_000;
const LOAD_BUSY_MESSAGE = 'the chat model is busy; load this model once the current reply finishes';
const UNLOAD_LEASE_WAIT_MS = 10_000;
const DEFAULT_COMPLETION_MODEL_CAP = 1;
const WEDGED_EVICT_LEASED_MS = 120_000;
function fitSrc(modelSrc) {
    if (typeof modelSrc === 'string')
        return modelSrc;
    const { src, name, sha256Checksum } = modelSrc;
    return { src, name, sha256Checksum };
}
function downloadBytes(modelSrc) {
    if (typeof modelSrc === 'string') {
        return assetBytes(modelSrc);
    }
    return isRecord(modelSrc) && typeof modelSrc.expectedSize === 'number'
        ? modelSrc.expectedSize
        : undefined;
}
function stagesBytes(srcs) {
    return srcs.reduce((sum, src) => sum + (assetBytes(src) ?? 0), 0);
}
export class Residency {
    gate;
    sdk;
    fit = new ModelFit(async (input) => (await this.sdk.load()).assessModelFit(input));
    _loads;
    _emit;
    _projectionFor;
    _otherPools;
    _poolFor;
    _embedRoom;
    _evictIdle;
    _unloadIdlePlugins;
    _tools;
    _skills;
    _pinned = new Set();
    _borrowed = new Set();
    _replying = [];
    _modelStatus = createModelStatusCache();
    _llmDevice;
    _llmGpuLayers;
    _contextSize;
    _kvCacheK;
    _kvCacheV;
    _llmLoad;
    _slots;
    _completionModelCap;
    _modelFaults = new Map();
    _idle;
    _hold;
    _capability;
    _sizeLoads = false;
    _capBytes = null;
    _reserved = new Map();
    _contexts = new ContextClimb(() => this._contextProfile());
    _admission = new ScopeLock();
    _byHand = new Map();
    _models;
    constructor(opts) {
        this.gate = opts.gate;
        this.sdk = opts.sdk;
        this._hold = opts.hold;
        this._capability = opts.capability;
        this._loads = opts.loads;
        this._emit = opts.emit;
        this._projectionFor = opts.projectionFor;
        this._otherPools = opts.pools;
        this._poolFor = opts.poolFor;
        this._embedRoom = opts.embedRoom;
        this._evictIdle = opts.evictIdle;
        this._unloadIdlePlugins = opts.unloadIdlePlugins;
        this._tools = opts.tools;
        this._skills = opts.skills;
        this._llmDevice = opts.llmDevice;
        this._llmGpuLayers = opts.llmGpuLayers;
        this._contextSize = opts.contextSize;
        this._kvCacheK = opts.kvCacheK;
        this._kvCacheV = opts.kvCacheV;
        this._llmLoad = opts.llmLoad;
        this._slots = opts.slots;
        this._completionModelCap = opts.completionModelCap ?? DEFAULT_COMPLETION_MODEL_CAP;
        this._models = this._createPool();
        this._idle = createIdleReaper({
            sweep: () => this._unloadIdleModels(),
            waitMs: WEDGED_EVICT_WAIT_MS,
            onError: (err) => HarnessLog.warn('idle unload failed', { err: errorMessage(err) })
        });
    }
    get pool() {
        return this._models;
    }
    get status() {
        return this._modelStatus;
    }
    tools() {
        return this._tools();
    }
    skills(agentId, model) {
        return this._skills(agentId, model);
    }
    recreate() {
        this.fit.clearRows();
        this._reserved.clear();
        this._byHand.clear();
        this._models = this._createPool();
    }
    destroy() {
        return this._models?.destroy();
    }
    setIdleTimeout(ms) {
        this._idle.configure(ms);
    }
    closeIdle() {
        this._idle.close();
    }
    invalidateStatus() {
        invalidateModelStatusCache(this._modelStatus);
    }
    statusChanged() {
        invalidateModelStatusCache(this._modelStatus);
        this.fit.clearRows();
    }
    async setMemoryCap(percent) {
        this._sizeLoads = true;
        const { mobile, memoryBudget } = await this._capability();
        this._capBytes =
            percent > 0 && !mobile && memoryBudget
                ? memoryCapBytes(percent, memoryBudget.availableBytes)
                : null;
        HarnessLog.info('memory cap', { percent, capBytes: this._capBytes });
        if (this._capBytes !== null) {
            await this.busy(() => this._admit(() => this._makeRoom(0, { generators: true })));
        }
    }
    settledBytes() {
        return this._pools()
            .flatMap((pool) => settledEntries(pool))
            .reduce((sum, { bytes }) => sum + (bytes ?? 0), 0);
    }
    memoryByModel() {
        const memory = new Map();
        for (const { key, bytes } of this._pools().flatMap((pool) => settledEntries(pool))) {
            if (bytes === undefined)
                continue;
            const model = modelOf(key);
            memory.set(model, (memory.get(model) ?? 0) + bytes);
        }
        return memory;
    }
    async makeRoomForPlugin(signal, busy, srcs = []) {
        if (this._capBytes !== null && !this._models.destroyed) {
            await this._makeRoomForGenerator(srcs, signal);
            return;
        }
        if (!(await this._roomForPlugin(signal, PLUGIN_EVICT_WAIT_MS))) {
            throw typeof busy === 'string' ? new Error(busy) : busy;
        }
    }
    async _makeRoomForGenerator(srcs, signal) {
        if (signal?.aborted) {
            throw new AbortedError();
        }
        await this._makeRoom(stagesBytes(srcs), { replying: true });
        if (signal?.aborted) {
            throw new AbortedError();
        }
    }
    async _roomForPlugin(signal, deadlineMs) {
        if (this._models.destroyed)
            return true;
        const evicted = await awaitModelCapacity(this._models, { cap: 1, deadlineMs, signal });
        if (signal?.aborted) {
            throw new AbortedError();
        }
        return evicted;
    }
    async borrow(model, signal) {
        this._borrowed.add(model);
        const loadOpts = resolveLoadOptions({}, this.deviceConfig());
        const key = modelKey(model, loadOpts);
        const pool = this._models;
        if (!isResident(pool, key)) {
            await this.makeRoomForCompletion(model, { loadOpts, signal });
        }
        try {
            const { modelId } = await raceAbort(pool.open(key, model, loadOpts).load(), signal);
            return { modelId, release: () => releaseModel(pool, key) };
        }
        catch (err) {
            releaseModel(pool, key);
            throw err;
        }
    }
    borrowed(model) {
        return this._borrowed.has(model);
    }
    evictIdleChat() {
        return evictIdleWhere(this._models, (key) => !this._pinned.has(key) && !this._replying.includes(key));
    }
    reply(key) {
        this._replying.push(key);
    }
    replied(key) {
        this._replying.splice(this._replying.indexOf(key), 1);
    }
    clearFaults(model) {
        this._modelFaults.delete(model);
    }
    loaded() {
        return this._pools().flatMap((pool) => loadedModels(pool));
    }
    loading() {
        return new Set(this._pools().flatMap((pool) => loadingModels(pool)));
    }
    settled() {
        return new Set(this._pools().flatMap((pool) => settledModels(pool)));
    }
    _pools() {
        return [this._models, ...this._otherPools()];
    }
    deviceConfig() {
        return {
            device: this._llmDevice,
            gpuLayers: this._llmGpuLayers,
            contextSize: this._contextSize,
            kvCacheK: this._kvCacheK,
            kvCacheV: this._kvCacheV,
            llama: this._llmLoad,
            slots: this._slots,
            mainGpu: resolveMainGpu,
            openclCacheDir,
            contextFor: (key) => this._contexts.chosen(key) ?? this.fit.chosen(key),
            slotsFor: (key) => this.fit.chosenSlots(key)
        };
    }
    _createPool() {
        const loadSdk = () => this.loadLifecycleSdk();
        return createModelPool(loadSdk, (state) => this.notify(state), {
            deviceConfig: this.deviceConfig(),
            loads: this._loads,
            onUnloadFailure: (modelId, error) => this.gate.recordModelUnloadFailure(modelId, error),
            beforeLoad: (load) => this.beforeLoad(load),
            chooseContext: (load, tier) => this._chooseContext(load, tier),
            hold: this._hold
        });
    }
    loadLifecycleSdk() {
        return this.sdk.load();
    }
    notify(state) {
        if (state.status === 'ready' || state.status === 'unloaded' || state.status === 'error') {
            invalidateModelStatusCache(this._modelStatus);
            this.fit.clearRows();
        }
        if (state.status === 'unloaded') {
            for (const key of this._pinned) {
                if (!isResident(this._models, key)) {
                    this._pinned.delete(key);
                }
            }
        }
        this._emit({
            ...state,
            catalogChanged: state.catalogChanged === true,
            loaded: this.loaded()
        });
    }
    async _unloadIdleModels() {
        if (!this.gate.opened || this.gate.closing || this.gate.suspended || this.gate.draining) {
            return;
        }
        HarnessLog.info('idle unload', { models: this.loaded().map((entry) => entry.model) });
        const [pools, plugins] = await Promise.all([
            Promise.allSettled([evictIdle(this._models), ...this._evictIdle()]),
            this._unloadIdlePlugins()
        ]);
        for (const outcome of [...pools, ...plugins]) {
            if (outcome.status !== 'rejected')
                continue;
            HarnessLog.warn('idle unload failed', { err: errorMessage(outcome.reason) });
        }
        invalidateModelStatusCache(this._modelStatus);
        this.fit.clearRows();
    }
    async rowFits(rows) {
        if (!rows.some((row) => row.type === 'llm')) {
            return new Map();
        }
        return this.fit
            .rows(() => this._rowQueries())
            .catch((err) => {
            HarnessLog.warn('fit estimate failed', { rows: rows.length, err: errorMessage(err) });
            return new Map();
        });
    }
    _rowQueries() {
        return new Map(curatedListables()
            .filter((listable) => listable.asset.addon === 'llm')
            .map(({ name, asset }) => {
            const load = {
                opts: this.loadOptions(name),
                deviceConfig: this.deviceConfig()
            };
            return [
                asset.registryPath,
                ModelFit.query(asset, contextSize(name, asset, load) * slotCount(name, load))
            ];
        }));
    }
    async warm({ model, agent, signal }) {
        if (!this.gate.opened) {
            await this.gate.ready();
        }
        this.gate.assertNotClosing();
        if (this.gate.suspended) {
            return;
        }
        const target = this._target(model, agent);
        HarnessLog.info('warm model', { model, resident: isResident(target.pool, target.key) });
        await this._loadAndRelease(target, signal, async () => {
            await this._embedRoom(model, target);
            if (isResident(target.pool, target.key)) {
                return true;
            }
            if (target.needsRoom) {
                return this._capBytes !== null || this._roomForPlugin(signal, WARM_ROOM_WAIT_MS);
            }
            if (!target.loadOpts) {
                return true;
            }
            return this.makeRoomForCompletion(model, {
                loadOpts: target.loadOpts,
                signal,
                deadlineMs: WARM_ROOM_WAIT_MS
            });
        });
    }
    async load({ model, agent, signal }) {
        if (!this.gate.opened) {
            await this.gate.ready();
        }
        if (this.gate.suspended) {
            throw new HarnessError('HARNESS_SUSPENDED');
        }
        const target = this._target(model, agent);
        const resident = isResident(target.pool, target.key);
        HarnessLog.info('load model', { model, resident });
        if (!resident && !(await this._admitByHand(model, target, signal))) {
            return { loaded: false, reason: 'memory' };
        }
        if (!target.loadOpts) {
            await this._loadByHand(target, signal, async () => {
                await this._embedRoom(model, target);
                if (target.needsRoom && !isResident(target.pool, target.key)) {
                    await this.makeRoomForPlugin(signal, LOAD_BUSY_MESSAGE);
                }
                return true;
            });
            return { loaded: true };
        }
        if (!resident) {
            await evictIdleWhere(this._models, this._replacedBy(model));
            await this._yieldGenerators();
        }
        this._pinned.add(target.key);
        try {
            await this._loadByHand(target, signal);
        }
        catch (err) {
            this._pinned.delete(target.key);
            throw err;
        }
        return { loaded: true };
    }
    async unload({ model }) {
        if (!this.gate.opened) {
            await this.gate.ready();
        }
        const target = this._target(model);
        const name = modelOf(target.key);
        const unloaded = await evictModel(target.pool, name, { deadlineMs: UNLOAD_LEASE_WAIT_MS });
        HarnessLog.info('unload model', { model, unloaded });
        if (unloaded) {
            for (const key of this._pinned) {
                if (modelOf(key) === name) {
                    this._pinned.delete(key);
                }
            }
        }
        return { unloaded };
    }
    async _loadAndRelease({ pool, key, open }, signal, prepare = async () => true) {
        const lease = await this.acquireLease({ pool, key, open, signal, prepare });
        lease?.release();
    }
    async _loadByHand(target, signal, prepare = async () => true) {
        let started = false;
        const settle = () => {
            if (this._byHand.delete(target.key)) {
                this._reserved.delete(target.key);
            }
        };
        try {
            const lease = await this.acquireLease({
                pool: target.pool,
                key: target.key,
                open: target.open,
                signal,
                prepare,
                onLoad: (loading) => {
                    started = true;
                    void loading.then(noop, noop).then(settle);
                }
            });
            lease?.release();
        }
        finally {
            if (!started) {
                settle();
            }
        }
    }
    async unloadIdleGenerators() {
        await this._unloadIdlePlugins();
    }
    async _yieldGenerators() {
        if (this._capBytes === null) {
            await this.unloadIdleGenerators();
        }
    }
    async _admitByHand(model, target, signal) {
        if (this._capBytes === null) {
            return this._chooseByHand(model, target, signal);
        }
        return this._admit(async () => {
            if (isResident(target.pool, target.key) || this._byHand.has(target.key)) {
                return true;
            }
            const sized = await this._sizeByHand(model, target);
            const capBytes = this._capBytes;
            const replaced = this._replacedEntries(model, target);
            const used = this._usedBytes() - replaced.reduce((sum, { bytes }) => sum + (bytes ?? 0), 0);
            const alone = this._alone(model, target);
            const fits = capBytes === null || alone || sized.bytes === undefined || used + sized.bytes <= capBytes;
            if ((sized.tooLarge && !alone) || !fits) {
                return false;
            }
            this._byHand.set(target.key, sized.ctxSize);
            if (sized.bytes !== undefined) {
                this._reserved.set(target.key, sized.bytes);
            }
            return true;
        });
    }
    async _chooseByHand(model, target, signal) {
        if (!target.loadOpts) {
            return true;
        }
        const choice = await this._loadDecision(model, target.loadOpts);
        if (choice?.fits === false) {
            return this._alone(model, target);
        }
        if (choice && !target.loadOpts.ctxSize && !signal?.aborted) {
            this.fit.keep(target.key, choice);
        }
        return true;
    }
    _replacedBy(model) {
        return (key) => modelOf(key) === model && !this._replying.includes(key);
    }
    _replacedEntries(model, target) {
        const replacedBy = this._replacedBy(model);
        return target.pool === this._models
            ? settledEntries(this._models).filter(({ key, refs }) => refs === 0 && replacedBy(key))
            : [];
    }
    _alone(model, target) {
        const settled = this._pools().flatMap((pool) => settledEntries(pool));
        const loading = this._pools().some((pool) => loadingModels(pool).length > 0);
        return (!loading &&
            this._reserved.size === 0 &&
            settled.length === this._replacedEntries(model, target).length);
    }
    async _sizeByHand(model, target) {
        const addon = modelAddonOf(model);
        const modelSrc = curatedModelAsset(model, addon) ?? customModelSrc(model, addon) ?? model;
        let ctxSize;
        let modelConfig;
        if (target.loadOpts) {
            const load = { opts: target.loadOpts, deviceConfig: this.deviceConfig() };
            const slots = slotCount(model, load);
            ctxSize = contextSize(model, modelSrc, load) * slots;
            modelConfig = {
                ctx_size: ctxSize,
                parallel: slots > 1 ? slots : undefined,
                projectionModelSrc: this._projectionFor(model)
            };
        }
        const sized = await this._sizeLoad({
            key: target.key,
            model,
            modelSrc,
            modelType: target.modelType,
            modelConfig
        });
        return { ...sized, ctxSize };
    }
    async _admit(run) {
        await this._admission.lock();
        try {
            return await run();
        }
        finally {
            this._admission.unlock();
        }
    }
    async beforeLoad(load) {
        if (!this._sizeLoads)
            return undefined;
        const bytes = this._byHand.has(load.key)
            ? await this._admit(() => this._reserveByHand(load))
            : await this._admit(() => this._reserve(load));
        return { bytes, release: () => this._reserved.delete(load.key) };
    }
    async _reserveByHand(load) {
        const admittedAt = this._byHand.get(load.key);
        this._byHand.delete(load.key);
        if (load.modelConfig?.['ctx_size'] !== admittedAt) {
            const { bytes } = await this._sizeLoad(load);
            if (bytes !== undefined) {
                this._reserved.set(load.key, bytes);
            }
        }
        return this._reserved.get(load.key);
    }
    async _reserve(load) {
        const sized = await this._sizeLoad(load);
        if (this._capBytes !== null) {
            await this._makeRoom(sized.bytes ?? 0, {
                generators: true,
                tooLarge: sized.tooLarge,
                recheck: async () => (await this._sizeLoad(load)).tooLarge
            });
        }
        if (sized.bytes !== undefined) {
            this._reserved.set(load.key, sized.bytes);
        }
        return sized.bytes;
    }
    async _sizeLoad({ model, modelSrc, modelType, modelConfig }) {
        const downloaded = downloadBytes(modelSrc);
        const { projectionModelSrc, ...config } = modelConfig ?? {};
        const projection = downloadBytes(projectionModelSrc) ?? 0;
        try {
            const sdk = await this.sdk.load();
            const { models } = await sdk.assessModelFit({
                models: [{ modelSrc: fitSrc(modelSrc), modelType, modelConfig: config }]
            });
            const [fit] = models;
            const bytes = fit?.floorBytes ?? downloaded;
            return {
                bytes: bytes === undefined ? undefined : bytes + projection,
                tooLarge: fit?.verdict === 'likely-too-large',
                confirmed: fit?.verdict === 'likely-fits' && fit.evidence === 'native-fit'
            };
        }
        catch (err) {
            HarnessLog.warn('fit estimate failed', { model, err: errorMessage(err) });
            return {
                bytes: downloaded === undefined ? undefined : downloaded + projection,
                tooLarge: false,
                confirmed: false
            };
        }
    }
    async _chooseContext(load, tier) {
        if (this._borrowed.has(load.model)) {
            return tier;
        }
        const parallel = load.modelConfig?.['parallel'];
        const slots = typeof parallel === 'number' ? parallel : 1;
        const ctxSize = await this._contexts.choose(load.key, tier, {
            trained: () => this._trainedContext(load),
            fits: async (rung) => {
                const sized = await this._sizeLoad({
                    ...load,
                    modelConfig: { ...load.modelConfig, ctx_size: rung * slots }
                });
                const room = this._capRoom(load.key);
                return sized.confirmed && (room === null || (sized.bytes ?? Infinity) <= room);
            }
        });
        HarnessLog.info('context chosen', { model: load.model, tier, ctxSize });
        return ctxSize;
    }
    _capRoom(key) {
        const cap = this._capBytes;
        return cap === null ? null : cap - (this._usedBytes() - (this._reserved.get(key) ?? 0));
    }
    async _contextProfile() {
        const { capabilityProfile, memoryBudget } = await this._capability();
        return memoryBudget ? capabilityProfile : undefined;
    }
    async _trainedContext({ model, modelSrc }) {
        const custom = customContextLength(model);
        if (custom || typeof modelSrc === 'string') {
            return custom;
        }
        const info = await this._modelInfo(modelSrc.name);
        const file = info?.cacheFiles[0]?.path;
        const bytes = file ? await readGgufHeaderBytes(file) : null;
        return (bytes && parseGgufHeader(bytes)?.contextLength) || undefined;
    }
    async _modelInfo(name) {
        try {
            const sdk = await this.sdk.load();
            return await sdk.getModelInfo({ name });
        }
        catch {
            return null;
        }
    }
    async _makeRoom(need, room) {
        const capBytes = this._capBytes;
        if (capBytes === null) {
            return;
        }
        const tried = new Set();
        let tooLarge = room.tooLarge ?? false;
        while (this._usedBytes() + need > capBytes || tooLarge) {
            const victim = nextVictim(this._capVictims(room).filter(({ id }) => !tried.has(id)));
            if (!victim) {
                HarnessLog.warn('model over memory cap', {
                    need,
                    used: this._usedBytes(),
                    capBytes,
                    tooLarge
                });
                return;
            }
            tried.add(victim.id);
            await victim.evict();
            if (tooLarge && room.recheck) {
                tooLarge = await room.recheck();
            }
        }
    }
    _capVictims({ replying = false, generators = false }) {
        const victims = [];
        if (generators) {
            victims.push({
                id: 'generators',
                rank: VictimRank.generator,
                lastUsed: 0,
                evict: () => this.unloadIdleGenerators()
            });
        }
        for (const [index, pool] of this._pools().entries()) {
            for (const { key, refs, lastUsed } of settledEntries(pool)) {
                const inReply = this._replying.includes(key);
                if (refs > 0 || (inReply && !replying)) {
                    continue;
                }
                victims.push({
                    id: `${index}:${key}`,
                    rank: this._victimRank(pool, key, inReply),
                    lastUsed,
                    evict: () => evictIdleWithin(pool, key, { deadlineMs: WEDGED_EVICT_WAIT_MS })
                });
            }
        }
        return victims;
    }
    _victimRank(pool, key, inReply) {
        if (pool !== this._models)
            return VictimRank.companion;
        if (inReply)
            return VictimRank.replying;
        return this._pinned.has(key) ? VictimRank.pinned : VictimRank.requested;
    }
    _usedBytes() {
        return this.settledBytes() + [...this._reserved.values()].reduce((sum, bytes) => sum + bytes, 0);
    }
    async _fits(model, loadOpts, { native = false } = {}) {
        const asset = curatedModelAsset(model, 'llm');
        if (!asset) {
            return true;
        }
        const load = { opts: loadOpts, deviceConfig: this.deviceConfig() };
        const contextTokens = contextSize(model, asset, load) * slotCount(model, load);
        const assessed = await this.fit.settle(ModelFit.query(asset, contextTokens, { native }));
        return assessed?.verdict !== 'likely-too-large';
    }
    async _loadDecision(model, loadOpts) {
        const asset = curatedModelAsset(model, 'llm');
        if (!asset) {
            return null;
        }
        const load = { opts: loadOpts, deviceConfig: this.deviceConfig() };
        const tier = contextSize(model, asset, load);
        const slots = slotCount(model, load);
        if (loadOpts.ctxSize || this.fit.chosen(modelKey(model, loadOpts))) {
            return { ctxSize: tier, slots, fits: await this._fits(model, loadOpts, { native: true }) };
        }
        return this.fit.ladder(asset, tier, slots);
    }
    async _yieldPins(model, loadOpts) {
        for (const key of this._pinned) {
            if (leaseCount(this._models, key) > 0 || this._replying.includes(key)) {
                continue;
            }
            if (await this._fits(model, loadOpts))
                return;
            this._pinned.delete(key);
            await evictModelWithin(this._models, key, { deadlineMs: WEDGED_EVICT_WAIT_MS });
        }
    }
    _target(model, agent) {
        const addon = modelAddonOf(model);
        if (addon === 'llm') {
            const loadOpts = this.loadOptions(model, agent);
            const key = modelKey(model, loadOpts);
            return {
                pool: this._models,
                key,
                modelType: 'llamacpp-completion',
                loadOpts,
                open: () => this._models.open(key, model, loadOpts)
            };
        }
        if (addon === 'embeddings' || addon === 'tts' || addon === 'parakeet') {
            return this._poolFor(addon, model);
        }
        throw new HarnessError('MODEL_NOT_RESIDENT', [model]);
    }
    loadOptions(model, agent) {
        return resolveLoadOptions({
            ctxSize: agent?.ctxSize ?? undefined,
            kvCacheK: agent?.kvCacheK ?? undefined,
            kvCacheV: agent?.kvCacheV ?? undefined,
            projectionModel: this._projectionFor(model)
        }, this.deviceConfig());
    }
    async acquireLease({ pool, key, open, signal, prepare, onLoad }) {
        const releaseWork = this.gate.enterWork();
        let pendingLoad = null;
        let opened = false;
        let released = false;
        const release = () => {
            if (released) {
                return;
            }
            released = true;
            try {
                if (opened) {
                    releaseModel(pool, key);
                }
            }
            finally {
                releaseWork();
            }
        };
        try {
            if (!(await prepare())) {
                release();
                return null;
            }
            if (signal?.aborted) {
                throw new AbortedError();
            }
            if (this.gate.suspended || this.gate.draining) {
                throw new HarnessError('HARNESS_SUSPENDED');
            }
            this.gate.assertNotClosing();
            if (this.gate.unloadFailed) {
                throw new Error('Runtime unload failed; close the harness before loading models again');
            }
            const handle = open();
            opened = true;
            const loading = handle.load();
            pendingLoad = loading;
            onLoad?.(loading);
            const loaded = await raceAbort(loading, signal);
            return { modelId: loaded.modelId, ctxSize: loaded.ctxSize, slots: loaded.slots, release };
        }
        catch (error) {
            if (pendingLoad) {
                void pendingLoad.then(release, release).catch(noop);
            }
            else {
                release();
            }
            throw error;
        }
    }
    async completionRuntime(request) {
        const releaseWork = this.gate.enterWork();
        try {
            return await prepareCompletionRuntime(this, request);
        }
        finally {
            releaseWork();
        }
    }
    servedRound(model) {
        const loadOpts = this.loadOptions(model);
        const key = modelKey(model, loadOpts);
        return { key, acquireRound: roundAcquirer(this, { model, key, loadOpts }) };
    }
    async makeRoomForCompletion(model, { loadOpts, signal, deadlineMs = MODEL_ROOM_WAIT_MS }) {
        if (this._capBytes !== null) {
            await evictIdleWhere(this._models, this._replacedBy(model));
            return true;
        }
        const roomed = await awaitModelCapacity(this._models, {
            cap: this._completionModelCap,
            deadlineMs,
            signal,
            evictable: (key) => !this._pinned.has(key) || modelOf(key) === model
        });
        if (roomed) {
            await this.unloadIdleGenerators();
        }
        else {
            HarnessLog.warn('model room wait gave up', {
                cap: this._completionModelCap,
                loaded: loadedModels(this._models).length
            });
        }
        await this._yieldPins(model, loadOpts);
        const key = modelKey(model, loadOpts);
        if (roomed && !signal?.aborted && !loadOpts.ctxSize && this.fit.chosen(key) === undefined) {
            const choice = await this._loadDecision(model, loadOpts);
            if (choice) {
                this.fit.keep(key, choice);
            }
        }
        return roomed;
    }
    async evictWedged(model, key) {
        const faults = (this._modelFaults.get(model) ?? 0) + 1;
        this._modelFaults.set(model, faults);
        const leased = leaseCount(this._models, key) > 0;
        const evicted = leased
            ? false
            : await evictModelWithin(this._models, key, { deadlineMs: WEDGED_EVICT_WAIT_MS });
        HarnessLog.warn('wedged model evicted', { model, faults, evicted, leased });
        if (leased) {
            this._evictAfterLeases(model, key);
        }
        if (!evicted && !leased) {
            return {
                message: `${model} is stuck in device memory — restarting the model runtime`,
                fatal: true
            };
        }
        return {
            message: faults > 1
                ? `${model} keeps failing during inference on this device — it may need more memory than is available`
                : `${model} failed during inference and was unloaded — try again`,
            fatal: false
        };
    }
    _evictAfterLeases(model, key) {
        void evictModelWithin(this._models, key, { deadlineMs: WEDGED_EVICT_LEASED_MS })
            .then((evicted) => HarnessLog.warn('wedged model evicted after leases', { model, evicted }))
            .catch(noop);
    }
    async busy(run) {
        await this._idle.enter();
        try {
            return await run();
        }
        finally {
            this._idle.exit();
        }
    }
    async *busyStream(run) {
        await this._idle.enter();
        try {
            yield* run();
        }
        finally {
            this._idle.exit();
        }
    }
}
function noop() { }
