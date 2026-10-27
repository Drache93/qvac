import { HarnessError } from '../errors.js';
import { createEmbedLane } from '../capabilities/embed.js';
import { AbortedError, raceAbort } from '../helpers/race-abort.js';
import { assertEmbedDevice, createEmbedConfig } from '../models/embed-config.js';
import { curatedModelAsset, residentSrc } from '../models/model-catalog.js';
import { ModelFit } from '../models/model-fit.js';
import { createEmbedPool, evictIdle, isResident, ModelUnloadError, releaseModel } from '../models/model-pool.js';
import { openclCacheDir } from '../models/opencl-cache.js';
import { createGpuFaultState, isSdkGpuDeviceLostError } from '../models/sdk-faults.js';
const EMBED_FIT_TOKENS = 1_048_576;
export class Embeddings {
    _sdk;
    _loads;
    _gate;
    _notify;
    _settleFit;
    _evictIdleChat;
    _beforeLoad;
    _hold;
    _embedModels;
    _retiredEmbedModels = new Set();
    _faultedEmbedKeys = new WeakMap();
    _embedLane = createEmbedLane();
    _embedFaults;
    _embedGpuLayers;
    _embedBatchSize;
    _embedControl = Promise.resolve();
    constructor(opts) {
        this._sdk = opts.sdk;
        this._loads = opts.loads;
        this._gate = opts.gate;
        this._notify = opts.notify;
        this._settleFit = opts.settleFit;
        this._evictIdleChat = opts.evictIdleChat;
        this._beforeLoad = opts.beforeLoad;
        this._hold = opts.hold;
        const embedConfig = createEmbedConfig({
            device: opts.device,
            gpuLayers: opts.gpuLayers,
            batchSize: opts.batchSize
        });
        this._embedGpuLayers = embedConfig.gpuLayers;
        this._embedBatchSize = embedConfig.batchSize;
        this._embedFaults = createGpuFaultState({
            device: embedConfig.device,
            gpuLayers: embedConfig.gpuLayers
        });
        this._embedModels = this._createEmbedPool();
    }
    get pool() {
        return this._embedModels;
    }
    get device() {
        return this._embedFaults.device;
    }
    pools() {
        return [this._embedModels, ...this._retiredEmbedModels];
    }
    target(model) {
        const key = this._embedFaults.key(residentSrc(model, 'embeddings'));
        return {
            pool: this._embedModels,
            key,
            modelType: 'llamacpp-embedding',
            open: () => this._embedModels.open(key, model)
        };
    }
    recreate() {
        this._embedModels = this._createEmbedPool();
    }
    evictIdle() {
        return [
            evictIdle(this._embedModels),
            ...[...this._retiredEmbedModels].map((pool) => this._collectRetiredEmbedPool(pool))
        ];
    }
    setDevice(device) {
        assertEmbedDevice(device);
        return this._enqueueEmbedControl(() => this._setEmbeddingDevice(device));
    }
    async makeRoom(model, { pool, key }) {
        const asset = curatedModelAsset(model, 'embeddings');
        if (!asset || pool !== this._embedModels || isResident(this._embedModels, key)) {
            return;
        }
        const assessed = await this._settleFit(ModelFit.query(asset, EMBED_FIT_TOKENS, { modelType: 'embeddings' }));
        if (assessed?.verdict !== 'likely-too-large') {
            return;
        }
        await this._evictIdleChat();
    }
    async destroy() {
        const pools = [this._embedModels, ...this._retiredEmbedModels].filter((pool) => Boolean(pool));
        const outcomes = await Promise.allSettled(pools.map(async (pool) => {
            await pool.destroy();
            this._retiredEmbedModels.delete(pool);
        }));
        const generic = outcomes.find((outcome) => outcome.status === 'rejected' && !(outcome.reason instanceof ModelUnloadError));
        if (generic?.status === 'rejected') {
            throw generic.reason;
        }
        const failed = outcomes.find((outcome) => outcome.status === 'rejected');
        if (failed?.status === 'rejected') {
            throw failed.reason;
        }
    }
    async embed({ model, texts, signal }) {
        if (!this._gate.opened) {
            await this._gate.ready();
        }
        this._gate.assertNotClosing();
        if (this._gate.suspended) {
            throw new HarnessError('HARNESS_SUSPENDED');
        }
        if (texts.length === 0) {
            return [];
        }
        const pool = this._embedModels;
        const faults = this._embedFaults;
        const generation = faults.generation;
        const key = faults.key(residentSrc(model, 'embeddings'));
        await this.makeRoom(model, { pool, key });
        const releaseWork = this._gate.enterWork();
        let handle;
        try {
            handle = pool.open(key, model);
        }
        catch (error) {
            releaseWork();
            throw error;
        }
        let loaded = null;
        let job = null;
        let releaseAfter = null;
        let collectAfter = null;
        let drainWorkAfter = null;
        try {
            loaded = await raceAbort(handle.load(), signal);
            const sdk = await this._sdk.loadEmbed();
            this._gate.assertNotClosing();
            job = this._embedLane(sdk, { modelId: loaded.modelId, texts });
            const vectors = await raceAbort(job, signal);
            faults.reset();
            return vectors;
        }
        catch (err) {
            if (err instanceof AbortedError) {
                if (job) {
                    releaseAfter = job;
                }
                else if (this._retiredEmbedModels.has(pool)) {
                    collectAfter = handle.peek();
                }
                else {
                    drainWorkAfter = handle.peek();
                }
            }
            if (isSdkGpuDeviceLostError(err)) {
                this._markEmbedFault({ pool, key, faults, generation });
            }
            throw err;
        }
        finally {
            if (releaseAfter) {
                void this._releaseEmbedResourceAfter(releaseAfter, {
                    pool,
                    key,
                    faults,
                    generation
                }).finally(releaseWork);
            }
            else if (collectAfter) {
                releaseModel(pool, key);
                const collect = () => this._collectRetiredEmbedPool(pool);
                void collectAfter.then(collect, collect).catch(noop).finally(releaseWork);
            }
            else {
                const releasing = this._releaseEmbedResource(pool, key);
                if (drainWorkAfter) {
                    void Promise.allSettled([releasing, drainWorkAfter]).then(releaseWork);
                }
                else {
                    await this._releaseEmbedResourceBeforeWork(releasing, releaseWork);
                }
            }
        }
    }
    _createEmbedPool() {
        const loadSdk = () => this._sdk.loadEmbed();
        return createEmbedPool(loadSdk, (state) => this._notify(state), {
            faults: this._embedFaults,
            batchSize: this._embedBatchSize,
            openclCacheDir,
            loads: this._loads,
            onUnloadFailure: (modelId, error) => this._gate.recordModelUnloadFailure(modelId, error),
            beforeLoad: this._beforeLoad,
            hold: this._hold
        });
    }
    async _collectRetiredEmbedPool(pool) {
        if (!this._retiredEmbedModels.has(pool) || pool.idle !== pool.size)
            return;
        try {
            await pool.destroy();
        }
        catch (error) {
            if (!(error instanceof ModelUnloadError)) {
                this._gate.recordPoolCleanupFailure();
            }
            throw error;
        }
        this._retiredEmbedModels.delete(pool);
    }
    async _releaseEmbedResource(pool, key) {
        releaseModel(pool, key);
        const faulted = this._faultedEmbedKeys.get(pool);
        if (faulted?.has(key)) {
            await evictIdle(pool);
            if (!isResident(pool, key)) {
                faulted.delete(key);
            }
        }
        await this._collectRetiredEmbedPool(pool);
    }
    async _releaseEmbedResourceBeforeWork(releasing, releaseWork) {
        try {
            await releasing;
        }
        finally {
            releaseWork();
        }
    }
    _markEmbedFault({ pool, key, faults, generation }) {
        faults.recordFault(generation);
        let faulted = this._faultedEmbedKeys.get(pool);
        if (!faulted) {
            faulted = new Set();
            this._faultedEmbedKeys.set(pool, faulted);
        }
        faulted.add(key);
    }
    _releaseEmbedResourceAfter(settled, fault) {
        return settled
            .then(() => this._releaseEmbedResource(fault.pool, fault.key), (error) => {
            if (isSdkGpuDeviceLostError(error)) {
                this._markEmbedFault(fault);
            }
            return this._releaseEmbedResource(fault.pool, fault.key);
        })
            .catch(noop);
    }
    _enqueueEmbedControl(run) {
        const next = this._embedControl.then(run, run);
        this._embedControl = next.catch(noop);
        return next;
    }
    async _setEmbeddingDevice(device) {
        if (!this._gate.opened) {
            await this._gate.ready();
        }
        if (this._gate.suspended) {
            this._gate.assertNotClosing();
            if (this._embedFaults.device === device) {
                return;
            }
            this._embedFaults = createGpuFaultState({ device, gpuLayers: this._embedGpuLayers });
            return;
        }
        const releaseWork = this._gate.enterWork();
        try {
            if (this._embedFaults.device === device) {
                return;
            }
            this._embedFaults = createGpuFaultState({ device, gpuLayers: this._embedGpuLayers });
            if (this._gate.suspended) {
                return;
            }
            const retired = this._embedModels;
            this._retiredEmbedModels.add(retired);
            this._embedModels = this._createEmbedPool();
            await this._collectRetiredEmbedPool(retired);
        }
        finally {
            releaseWork();
        }
    }
}
function noop() { }
