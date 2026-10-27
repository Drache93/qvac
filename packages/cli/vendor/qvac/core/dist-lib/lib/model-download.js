import { AbortController } from 'bare-abort-controller';
import { modelsForAgent, musicModelChoiceFrom } from '@qvac/harness/lib/models/model-catalog.ts';
import { GENERATE_MUSIC_TOOL } from '@qvac/harness/music-catalog';
import { DeadlineScheduler } from './deadline.js';
import { DownloadSpeedSampler, progressBytes, transferProgress } from '@qvac/harness/model-progress';
import { ModelDownloadStatus } from './model-download-status.js';
import { RetryBudget } from './retry-budget.js';
import { unref } from './unref.js';
import b4a from 'b4a';
import { errorMessage } from './guards.js';
import { CoreError } from './errors.js';
const WATCH_RETRY_MS = 30_000;
const LOCAL_PROGRESS_INTERVAL_MS = 750;
const LOCAL_PROGRESS_PERCENTAGE_STEP = 1;
const MAX_DEMAND_FAILURES = 3;
export class ModelDownloadReconciler {
    _engine;
    _meshId;
    _harness;
    _deviceId;
    _onCacheChanged;
    _log;
    _status;
    _retry;
    _now;
    _watchRetryMs;
    _mobileClass;
    _scheduler;
    _attemptGenerations = new Map();
    _transfers = new Map();
    _completedTransfers = new Set();
    _pendingCompletions = new Map();
    _observedTransfers = new Set();
    _observedProgress = new Map();
    _observedSpeed = new Map();
    _requestedModels = new Set();
    _heldLoads = new Set();
    _releasing = new Set();
    _targetTotals = new Map();
    _config = null;
    _active = null;
    _localLlm = null;
    _localSkillModels = [];
    _musicChoice = undefined;
    _preemptLlm = null;
    _pausedLocalLlm = null;
    _capability = null;
    _handled = new Set();
    _demands = new Map();
    _dirty = false;
    _running = null;
    _paused = false;
    _runModels = new Set();
    _closed = false;
    _configStream = null;
    _agentsStream = null;
    _toolConfigsStream = null;
    _toolConfigsAgentId = null;
    _timers = new Set();
    constructor({ engine, harness, deviceId, meshId, onCacheChanged, retryMs, now = Date.now, createScheduler = (onFire) => new DeadlineScheduler(onFire), logger = null, mobileClass = false }) {
        this._engine = engine;
        this._meshId = meshId;
        this._harness = harness;
        this._deviceId = deviceId;
        this._onCacheChanged = onCacheChanged;
        this._log = logger;
        this._status = new ModelDownloadStatus(engine, logger);
        this._retry = new RetryBudget(retryMs === undefined ? {} : { retryMs });
        this._now = now;
        this._scheduler = createScheduler(() => this._kick());
        this._watchRetryMs = retryMs ?? WATCH_RETRY_MS;
        this._mobileClass = mobileClass;
    }
    start() {
        if (!this._harness.download)
            return;
        this._reset().finally(() => {
            if (this._closed)
                return;
            this._watchConfig();
            this._watchAgents();
            this._kick();
        });
    }
    async _reset() {
        try {
            const it = this._engine.modelDownloadsWatch({})[Symbol.asyncIterator]();
            const first = await it.next();
            await it.return?.();
            for (const row of first.value?.downloads ?? []) {
                await this._engine.clearModelDownload({ name: row.name }).catch(noop);
            }
        }
        catch (err) {
            this._log?.warn('model-download', 'stale local status reset failed', err);
        }
    }
    async suspend() {
        this._paused = true;
        this._scheduler.clear();
        await this._stopActive(false);
        await this._running;
    }
    resume() {
        if (this._closed)
            return;
        this._paused = false;
        this._kick();
    }
    meshAdopted() {
        if (this._closed)
            return;
        const agents = this._agentsStream;
        this._agentsStream = null;
        if (agents?.return) {
            void agents.return().catch(noop);
        }
        this._watchAgents();
        this._swapToolConfigsWatch(this._toolConfigsAgentId);
        this._kick();
    }
    yieldToRuns(models) {
        if (this._closed)
            return;
        const next = new Set(models);
        if (next.size === this._runModels.size && [...next].every((m) => this._runModels.has(m))) {
            return;
        }
        this._runModels = next;
        this._kick();
    }
    observeHeldLoad(model) {
        if (this._closed)
            return;
        this._heldLoads.add(model);
        this._kick();
    }
    observeDroppedHeldLoad(model) {
        if (this._closed || !this._heldLoads.delete(model))
            return;
        this._kick();
    }
    observeImageProgress(observation) {
        if (this._closed)
            return;
        if (observation.phase === 'downloading') {
            this._observedTransfers.add(observation.model);
            if (this._completedTransfers.delete(observation.model)) {
                this._transfers.delete(observation.model);
            }
            void this._transfer(observation.model).catch((error) => {
                this._log?.warn('model-download', 'recording observed transfer failed', error);
            });
        }
        else if (!this._transfers.has(observation.model) &&
            !this._observedTransfers.has(observation.model)) {
            return;
        }
        this._observedProgress.set(observation.model, {
            ...observation,
            at: this._now(),
            percentage: Math.max(0, Math.min(100, Math.floor(observation.percentage))),
            downloaded: Math.max(0, Math.floor(observation.downloaded)),
            total: Math.max(0, Math.floor(observation.total))
        });
        this._kick();
    }
    _transfer(name) {
        let transfer = this._transfers.get(name);
        if (!transfer) {
            transfer = this._engine.beginModelTransfer({ name }).catch((error) => {
                this._transfers.delete(name);
                throw error;
            });
            this._transfers.set(name, transfer);
        }
        return transfer;
    }
    async _completeTransfer(name, { downloaded = true } = {}) {
        this._pendingCompletions.set(name, downloaded);
        await this._engine.completeModelTransfer({ ...(await this._transfer(name)), downloaded });
        this._pendingCompletions.delete(name);
        this._completedTransfers.add(name);
    }
    async waitUntilCached(model, signal, { onHold } = {}) {
        if (this._closed ||
            !this._harness.list ||
            !this._harness.download ||
            this._handled.has(model) ||
            signal.aborted) {
            return;
        }
        const rows = await this._harness.list({}).catch(noop);
        if (this._closed || this._handled.has(model) || signal.aborted) {
            return;
        }
        let addon = 'llm';
        if (rows) {
            const row = rows.find((entry) => entry.name === model);
            if (!row || row.isCached) {
                return;
            }
            addon = row.type;
        }
        await new Promise((resolve, reject) => {
            const abort = () => {
                this._removeDemandWaiter(model, waiter);
                resolve();
            };
            const waiter = { signal, abort, reject, resolve, onHold: onHold ?? null };
            const demand = this._demands.get(model) ?? {
                addon,
                failures: 0,
                waiters: new Set()
            };
            demand.waiters.add(waiter);
            this._demands.set(model, demand);
            signal.addEventListener('abort', abort, { once: true });
            this._kick();
        });
    }
    async retry(name) {
        if (this._closed)
            throw new CoreError('MODEL_DOWNLOAD_CLOSED');
        this._requestedModels.add(name);
        this._attemptGenerations.set(name, this._attemptGeneration(name) + 1);
        const demand = this._demands.get(name);
        if (demand) {
            demand.failures = 0;
        }
        this._retry.reset(name);
        this._scheduler.clear();
        if (this._active?.model === name) {
            await this._stopActive(false);
        }
        this._kick();
    }
    async release(name, removeFiles) {
        if (this._closed)
            throw new CoreError('MODEL_DOWNLOAD_CLOSED');
        this._releasing.add(name);
        this._requestedModels.delete(name);
        this._handled.delete(name);
        try {
            if (this._active?.model === name) {
                await this._stopActive(true);
            }
            const result = await removeFiles();
            this._config = await this._engine.setModelReleased({ name, released: true });
            await this._running;
            return result;
        }
        finally {
            this._releasing.delete(name);
            this._kick();
        }
    }
    async close() {
        this._closed = true;
        this._scheduler.clear();
        for (const timer of this._timers) {
            clearTimeout(timer);
        }
        this._timers.clear();
        if (this._configStream?.return) {
            await this._configStream.return();
        }
        if (this._agentsStream?.return) {
            await this._agentsStream.return();
        }
        if (this._toolConfigsStream?.return) {
            await this._toolConfigsStream.return();
        }
        await this._stopActive(false);
        await this._running;
        for (const name of [...this._demands.keys()]) {
            this._resolveDemand(name);
        }
    }
    _watchConfig() {
        if (this._closed)
            return;
        const run = async () => {
            const stream = this._engine.configWatchTyped({});
            this._configStream = stream[Symbol.asyncIterator]();
            while (true) {
                const { value, done } = await this._configStream.next();
                if (done || this._closed) {
                    return;
                }
                this._config = value;
                this._syncToolConfigsWatch();
                this._kick();
            }
        };
        run().catch((err) => this._restartWatch('config', err, () => this._watchConfig()));
    }
    _syncToolConfigsWatch() {
        const agentId = this._config?.activeAgentId ?? null;
        if (agentId === this._toolConfigsAgentId) {
            return;
        }
        this._swapToolConfigsWatch(agentId);
    }
    _swapToolConfigsWatch(agentId) {
        const previous = this._toolConfigsStream;
        this._toolConfigsStream = null;
        this._toolConfigsAgentId = agentId;
        if (previous?.return) {
            void previous.return().catch(noop);
        }
        if (agentId) {
            this._watchToolConfigs(agentId);
        }
    }
    _watchToolConfigs(agentId) {
        if (this._closed)
            return;
        const meshId = this._meshId();
        if (!meshId) {
            return;
        }
        let active = null;
        const run = async () => {
            const stream = this._engine.toolConfigsWatch({ agentId, meshId });
            const iterator = stream[Symbol.asyncIterator]();
            active = iterator;
            this._toolConfigsStream = iterator;
            while (true) {
                const { done } = await iterator.next();
                if (done || this._closed || this._toolConfigsStream !== iterator) {
                    return;
                }
                this._kick();
            }
        };
        run().catch((err) => {
            if (active && this._toolConfigsStream !== active)
                return;
            this._restartWatch('toolConfigs', err, () => {
                if (this._toolConfigsAgentId === agentId) {
                    this._watchToolConfigs(agentId);
                }
            });
        });
    }
    _watchAgents() {
        if (this._closed)
            return;
        const meshId = this._meshId();
        if (!meshId) {
            return;
        }
        let active = null;
        const run = async () => {
            const stream = this._engine.agentsWatch({ meshId });
            const iterator = stream[Symbol.asyncIterator]();
            active = iterator;
            this._agentsStream = iterator;
            while (true) {
                const { done } = await iterator.next();
                if (done || this._closed || this._agentsStream !== iterator) {
                    return;
                }
                this._kick();
            }
        };
        run().catch((err) => {
            if (active && this._agentsStream !== active)
                return;
            this._restartWatch('agents', err, () => this._watchAgents());
        });
    }
    _restartWatch(name, err, restart) {
        if (this._closed)
            return;
        this._log?.error('model-download', `${name} watch failed — restarting`, err);
        this._scheduleRestart(restart);
    }
    _scheduleRestart(restart) {
        const timer = setTimeout(() => {
            this._timers.delete(timer);
            if (this._closed) {
                return;
            }
            restart();
        }, this._watchRetryMs);
        unref(timer);
        this._timers.add(timer);
    }
    _kick() {
        if (this._closed || this._paused)
            return;
        this._dirty = true;
        if (this._running) {
            return;
        }
        this._running = this._drain().finally(() => {
            this._running = null;
            if (this._dirty) {
                this._kick();
            }
        });
    }
    async _drain() {
        while (this._dirty && !this._closed && !this._paused) {
            this._dirty = false;
            try {
                await this._step();
            }
            catch (err) {
                this._log?.warn('model-download', 'reconcile step failed', err);
                if (this._pendingCompletions.size > 0 || this._observedProgress.size > 0) {
                    this._scheduler.schedule(this._now() + this._watchRetryMs);
                }
            }
        }
    }
    async _step() {
        for (const [name, downloaded] of this._pendingCompletions) {
            await this._completeTransfer(name, { downloaded });
            this._handled.add(name);
            await this._status.clear(name);
            this._resolveDemand(name);
            this._onCacheChanged();
        }
        await this._flushObservedProgress();
        const targets = await this._desired();
        if (this._closed || this._paused) {
            return;
        }
        const downloadable = new Map(targets.filter((t) => !t.paused && !t.held).map((t) => [t.name, t]));
        if (this._active && !downloadable.has(this._active.model)) {
            const stillWanted = targets.some((t) => t.name === this._active?.model);
            await this._stopActive(!stillWanted);
        }
        const now = this._now();
        this._scheduleNextRetry(downloadable, now);
        const preferred = this._nextTarget(downloadable, now);
        if (this._runModels.size === 0) {
            const preemptLlm = this._preemptLlm;
            this._preemptLlm = null;
            if (this._shouldPreempt(preferred, preemptLlm)) {
                await this._stopActive(false);
            }
        }
        const next = this._active ? null : preferred;
        await this._writeWaiting(targets, next?.name, now);
        this._announceHolds(targets);
        if (next && !this._closed && !this._paused) {
            this._begin(next);
        }
    }
    async _writeWaiting(targets, nextName, now) {
        for (const target of targets) {
            if (target.paused) {
                await this._status.write(target.name, 'paused', { bytesPerSecond: 0 });
            }
            else if (target.held) {
                await this._status.write(target.name, 'held', { total: target.total, bytesPerSecond: 0 });
            }
            else if (this._waiting(target.name, nextName, now)) {
                await this._status.write(target.name, 'queued', {
                    total: target.total,
                    bytesPerSecond: 0
                });
            }
        }
    }
    _announceHolds(targets) {
        for (const target of targets) {
            if (!target.held)
                continue;
            for (const waiter of this._demands.get(target.name)?.waiters ?? []) {
                const onHold = waiter.onHold;
                waiter.onHold = null;
                onHold?.();
            }
        }
    }
    async _flushObservedProgress() {
        for (const [model, progress] of this._observedProgress) {
            await this._transfer(model);
            const expectedTotal = this._targetTotals.get(model) ?? progress.total;
            if (progress.phase === 'complete') {
                await this._completeTransfer(model);
                this._observedTransfers.delete(model);
                if (this._observedProgress.get(model) === progress) {
                    this._observedProgress.delete(model);
                }
                this._handled.add(model);
                this._retry.reset(model);
                this._observedSpeed.delete(model);
                await this._status.clear(model);
                this._resolveDemand(model);
                this._onCacheChanged();
                continue;
            }
            await this._engine.beginModelTransfer({ name: model, transferred: true });
            if (this._observedProgress.get(model) === progress) {
                this._observedProgress.delete(model);
            }
            const total = progress.total > 0 ? progress.total : expectedTotal;
            const downloaded = total > 0 ? Math.min(progress.downloaded, total) : progress.downloaded;
            let speed = this._observedSpeed.get(model);
            if (!speed) {
                speed = new DownloadSpeedSampler();
                this._observedSpeed.set(model, speed);
            }
            await this._status.write(model, 'downloading', {
                percentage: progress.percentage,
                downloaded,
                total,
                bytesPerSecond: speed.sample({ downloaded, total, aggregate: true }, progress.at, model)
            });
        }
    }
    _shouldPreempt(preferred, preemptLlm) {
        if (preferred !== null &&
            this._demands.has(preferred.name) &&
            this._active !== null &&
            this._active.model !== preferred.name) {
            return true;
        }
        return (preemptLlm !== null &&
            this._active !== null &&
            this._active.addon !== 'llm' &&
            preferred?.addon === 'llm' &&
            preferred.name === preemptLlm);
    }
    _waiting(name, nextName, now) {
        return (this._active?.model !== name &&
            nextName !== name &&
            !this._handled.has(name) &&
            this._retry.ready(name, now));
    }
    _nextTarget(downloadable, now) {
        for (const target of downloadable.values()) {
            if (this._handled.has(target.name))
                continue;
            if (!this._retry.ready(target.name, now))
                continue;
            return target;
        }
        return null;
    }
    _scheduleNextRetry(downloadable, now) {
        this._scheduler.clear();
        const deadline = this._retry.nextDeadline(new Set(downloadable.keys()), now);
        if (deadline !== null) {
            this._scheduler.schedule(deadline);
        }
    }
    async _desired() {
        if (this._config === null) {
            return [];
        }
        if (this._demands.size === 0 &&
            this._heldLoads.size === 0 &&
            this._handled.size === 0 &&
            !this._config?.onboardingCompleted) {
            await this._status.clearUnwanted(new Set());
            this._targetTotals.clear();
            this._observedProgress.clear();
            this._observedSpeed.clear();
            return [];
        }
        const availability = await this._modelAvailability();
        for (const name of availability.cached) {
            this._handled.delete(name);
        }
        const paused = new Set(this._config?.pausedModels ?? []);
        await this._reclaimCached(new Set([...availability.cached, ...this._handled]));
        const released = new Set([...(this._config?.releasedModels ?? []), ...this._releasing]);
        const wanted = new Map();
        for (const [name, demand] of this._demands) {
            wanted.set(name, { name, addon: demand.addon, paused: paused.has(name) });
        }
        if (this._config?.onboardingCompleted) {
            await this._refreshLocalAgentModels();
            const profile = await this._deviceProfile();
            const infra = (await this._harness.infraModels?.(profile)) ?? [];
            const localLlm = this._localLlm;
            if (localLlm !== null && this._pausedLocalLlm === localLlm && !paused.has(localLlm)) {
                this._preemptLlm = localLlm;
            }
            this._pausedLocalLlm = localLlm !== null && paused.has(localLlm) ? localLlm : null;
            if (localLlm && !wanted.has(localLlm) && !released.has(localLlm)) {
                wanted.set(localLlm, { name: localLlm, addon: 'llm', paused: paused.has(localLlm) });
            }
            for (const model of [...this._localSkillModels, ...infra]) {
                if (!wanted.has(model.name) && !released.has(model.name)) {
                    wanted.set(model.name, { ...model, paused: paused.has(model.name) });
                }
            }
        }
        for (const name of this._requestedModels) {
            if (wanted.has(name))
                continue;
            const addon = availability.addons.get(name);
            if (addon === undefined) {
                continue;
            }
            wanted.set(name, { name, addon, paused: paused.has(name) });
        }
        for (const name of this._heldLoads) {
            if (this._config?.autoDownloadModels !== false || availability.cached.has(name)) {
                this._heldLoads.delete(name);
                continue;
            }
            const addon = availability.addons.get(name);
            if (!wanted.has(name) && addon !== undefined) {
                wanted.set(name, { name, addon, paused: paused.has(name) });
            }
        }
        const wantedNames = new Set(wanted.keys());
        for (const name of this._attemptGenerations.keys()) {
            if (!wantedNames.has(name)) {
                this._attemptGenerations.delete(name);
            }
        }
        this._retry.retain(wantedNames);
        await this._status.clearUnwanted(wantedNames);
        const pending = [];
        for (const model of wanted.values()) {
            if (availability.cached.has(model.name)) {
                this._requestedModels.delete(model.name);
                this._resolveDemand(model.name);
                await this._status.clear(model.name);
                continue;
            }
            pending.push({
                ...model,
                held: this._heldBack(model.name),
                total: availability.totals.get(model.name) ?? 0
            });
        }
        const pendingNames = new Set(pending.map((target) => target.name));
        for (const target of pending) {
            this._targetTotals.set(target.name, target.total);
        }
        for (const name of this._targetTotals.keys()) {
            if (pendingNames.has(name))
                continue;
            this._targetTotals.delete(name);
            this._observedProgress.delete(name);
            this._observedSpeed.delete(name);
        }
        return pending;
    }
    _heldBack(name) {
        return this._config?.autoDownloadModels === false && !this._requestedModels.has(name);
    }
    async _reclaimCached(cached) {
        for (const name of this._config?.releasedModels ?? []) {
            if (!cached.has(name) || this._releasing.has(name))
                continue;
            this._config = await this._engine.setModelReleased({ name, released: false });
        }
    }
    async _modelAvailability() {
        const rows = (await this._harness.list?.({}).catch(() => [])) ?? [];
        const cached = new Set(rows.filter((row) => row.isCached).map((row) => row.name));
        const addons = new Map(rows.map((row) => [row.name, row.type]));
        const totals = new Map(rows.map((row) => [
            row.name,
            typeof row.expectedSize === 'number' && row.expectedSize > 0
                ? Math.floor(row.expectedSize)
                : 0
        ]));
        return { cached, totals, addons };
    }
    async _deviceProfile() {
        return (await this._hostCapability())?.capabilityProfile ?? 'low';
    }
    async _hostCapability() {
        if (this._capability)
            return this._capability;
        try {
            const probed = await this._harness.capability?.();
            if (!probed?.recommendedModelName) {
                return null;
            }
            this._capability = { ...probed, mobile: this._mobileClass };
            return this._capability;
        }
        catch (err) {
            this._log?.warn('model-download', 'capability probe failed', err);
            return null;
        }
    }
    async _refreshLocalAgentModels() {
        const activeAgentId = this._config?.activeAgentId;
        const meshId = this._meshId();
        if (!activeAgentId || !meshId) {
            return;
        }
        const agent = await this._engine.getAgent({ agentId: activeAgentId, meshId }).catch(noop);
        if (!agent?.modelName) {
            return;
        }
        if (!agent.providerDeviceId || !b4a.equals(agent.providerDeviceId, this._deviceId)) {
            return;
        }
        const host = await this._hostCapability();
        const music = await this._musicModelChoice(activeAgentId);
        if (this._config?.activeAgentId !== activeAgentId) {
            return;
        }
        if (music.ok) {
            this._musicChoice = music.choice;
        }
        const models = modelsForAgent({ ...agent, musicModelChoice: this._musicChoice }, host);
        this._adoptLocalModels(agent.modelName, models);
    }
    _adoptLocalModels(requested, models) {
        const model = models.find((entry) => entry.use === 'chat')?.name ?? requested;
        if (model !== requested) {
            this._log?.warn('model-download', 'model clamped to what this device can run', {
                requested,
                model
            });
        }
        if (model !== this._localLlm) {
            this._preemptLlm = model;
        }
        this._localLlm = model;
        this._localSkillModels = models
            .filter((entry) => entry.use !== 'chat')
            .map(({ name, addon }) => ({ name, addon }));
    }
    async _musicModelChoice(agentId) {
        const meshId = this._meshId();
        if (!meshId) {
            return { ok: false };
        }
        const configs = await this._engine
            .listToolConfigs({ agentId, meshId })
            .then((result) => result.configs ?? [])
            .catch(noop);
        if (!configs) {
            return { ok: false };
        }
        return { ok: true, choice: musicModelChoiceOf(configs) };
    }
    _begin({ name, addon, total }) {
        const controller = new AbortController();
        const done = this._download(name, controller, {
            addon,
            expectedTotal: total,
            attemptGeneration: this._attemptGeneration(name)
        });
        this._active = { model: name, addon, total, controller, done };
    }
    _removeDemandWaiter(model, waiter) {
        const demand = this._demands.get(model);
        if (!demand) {
            return;
        }
        demand.waiters.delete(waiter);
        waiter.signal.removeEventListener('abort', waiter.abort);
        if (demand.waiters.size === 0) {
            this._demands.delete(model);
        }
        this._kick();
    }
    _resolveDemand(model) {
        const demand = this._demands.get(model);
        if (!demand) {
            return;
        }
        this._demands.delete(model);
        for (const waiter of demand.waiters) {
            waiter.signal.removeEventListener('abort', waiter.abort);
            waiter.resolve();
        }
    }
    _failDemand(model, message) {
        const demand = this._demands.get(model);
        if (!demand) {
            return;
        }
        demand.failures += 1;
        if (demand.failures < MAX_DEMAND_FAILURES) {
            return;
        }
        this._demands.delete(model);
        for (const waiter of demand.waiters) {
            waiter.signal.removeEventListener('abort', waiter.abort);
            waiter.reject(new Error(message));
        }
    }
    _attemptGeneration(name) {
        return this._attemptGenerations.get(name) ?? 0;
    }
    async _stopActive(clear) {
        const active = this._active;
        if (!active) {
            return;
        }
        this._active = null;
        active.controller.abort('model-download superseded');
        await active.done;
        if (clear) {
            await this._status.clear(active.model);
        }
    }
    async _download(model, controller, { addon, expectedTotal, attemptGeneration }) {
        const current = () => this._active?.controller === controller;
        const speed = new DownloadSpeedSampler();
        let localFlush = null;
        let hasTransfer = false;
        let recordedTransfer = false;
        let retry = false;
        let completed = false;
        let failureMessage = 'model download failed';
        const recordProgress = async (event) => {
            const at = this._now();
            const transfer = transferProgress(event);
            if (!recordedTransfer &&
                (event.transferred === true ||
                    (event.transferred === undefined && transfer && transfer.percentage < 100))) {
                await this._engine.beginModelTransfer({ name: model, transferred: true });
                recordedTransfer = true;
            }
            if (hasTransfer && isEmptyTick(transfer)) {
                return;
            }
            const bytes = transfer ?? progressBytes(event);
            const percentage = transfer?.percentage ?? 0;
            if (shouldFlush(localFlush, { at, percentage })) {
                const written = await this._status.write(model, 'downloading', {
                    percentage,
                    downloaded: bytes.downloaded,
                    total: bytes.total,
                    bytesPerSecond: speed.sample(bytes, at, event.downloadKey)
                });
                if (written) {
                    localFlush = { at, percentage };
                    hasTransfer ||= !isEmptyTick(transfer);
                }
            }
        };
        try {
            if (this._completedTransfers.delete(model)) {
                this._transfers.delete(model);
            }
            await this._transfer(model);
            if (controller.signal.aborted || !current()) {
                return;
            }
            const initialPercentage = 0;
            const initialAt = this._now();
            if (await this._status.write(model, 'downloading', {
                percentage: 0,
                downloaded: 0,
                total: expectedTotal,
                bytesPerSecond: 0
            })) {
                localFlush = { at: initialAt, percentage: initialPercentage };
            }
            if (!this._harness.download) {
                throw new Error('the harness cannot download models');
            }
            for await (const event of this._harness.download({
                model,
                addon,
                signal: controller.signal
            })) {
                if (this._closed || !current())
                    return;
                if (event.type === 'complete' && controller.signal.aborted)
                    return;
                if (event.type === 'progress') {
                    await recordProgress(event);
                }
                else if (event.type === 'complete') {
                    await this._completeTransfer(model, { downloaded: event.downloaded !== false });
                    completed = true;
                    retry = false;
                    this._handled.add(model);
                    this._retry.reset(model);
                    await this._status.clear(model);
                    this._resolveDemand(model);
                    this._onCacheChanged();
                }
                else if (event.type === 'error' && current()) {
                    retry = true;
                    failureMessage = typeof event.message === 'string' ? event.message : 'download failed';
                    await this._status.write(model, 'error', {
                        error: failureMessage,
                        bytesPerSecond: 0
                    });
                }
                else if (event.type === 'aborted' && current() && !controller.signal.aborted) {
                    retry = true;
                    failureMessage = 'download interrupted';
                    await this._status.write(model, 'error', {
                        error: failureMessage,
                        bytesPerSecond: 0
                    });
                }
            }
            if (current() && !controller.signal.aborted && !completed && !retry) {
                retry = true;
            }
        }
        catch (err) {
            if (!this._closed && current()) {
                retry = true;
                failureMessage = errorMessage(err);
                await this._status.write(model, 'error', {
                    error: failureMessage,
                    bytesPerSecond: 0
                });
            }
        }
        finally {
            const wasCurrent = current();
            if (wasCurrent) {
                this._active = null;
            }
            if (retry &&
                !this._closed &&
                !this._paused &&
                attemptGeneration === this._attemptGeneration(model)) {
                this._failDemand(model, failureMessage);
                this._scheduler.schedule(this._retry.fail(model, this._now()));
            }
            if (!this._closed && !this._paused && wasCurrent) {
                this._kick();
            }
        }
    }
}
function isEmptyTick(transfer) {
    return (transfer === null ||
        (transfer.percentage === 0 && transfer.downloaded === 0 && transfer.total === 0));
}
function shouldFlush(previous, { at, percentage }) {
    return (previous === null ||
        at - previous.at >= LOCAL_PROGRESS_INTERVAL_MS ||
        percentage - previous.percentage >= LOCAL_PROGRESS_PERCENTAGE_STEP);
}
export function musicModelChoiceOf(configs) {
    const music = configs.find((entry) => entry?.toolName === GENERATE_MUSIC_TOOL);
    return musicModelChoiceFrom(music?.settings);
}
function noop() { }
