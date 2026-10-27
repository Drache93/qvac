import process from 'process';
import { HarnessError } from '../errors.js';
import { transferProgress } from '../model-download-progress.js';
import ResourcePuddle from 'resource-puddle';
import { ModelHandle } from './model-handle.js';
import { defaultContextSize } from './context.js';
import { customContextLength } from './model-catalog.js';
import { adrenoSafeKvCache } from './kv-cache.js';
import { DEFAULT_EMBED_BATCH_SIZE } from './embed-config.js';
import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
import { RUNAWAY_STOP_SEQUENCES } from '../helpers/control-tokens.js';
import { raceTimeout } from '../helpers/race-timeout.js';
import { resolveModelSrc, resolveProjectionSrc } from './model-source.js';
import { AbortedError } from '../helpers/race-abort.js';
export class ModelUnloadError extends Error {
    constructor(cause) {
        super(errorMessage(cause));
        this.name = 'ModelUnloadError';
    }
}
export function createLoadTracker() {
    const inflight = new Set();
    let draining = false;
    let drainSdk = null;
    const cancel = (sdk, requestId) => {
        if (!sdk.cancel) {
            return;
        }
        void sdk.cancel({ requestId }).catch(noop);
    };
    return {
        get draining() {
            return draining;
        },
        track(pending, sdk) {
            const { requestId } = pending;
            if (!requestId) {
                return pending;
            }
            if (draining) {
                const canceller = sdk ?? drainSdk;
                if (canceller) {
                    cancel(canceller, requestId);
                    return pending;
                }
            }
            inflight.add(requestId);
            const untrack = () => inflight.delete(requestId);
            pending.then(untrack, untrack);
            return pending;
        },
        drain(sdk) {
            draining = true;
            if (sdk) {
                drainSdk = sdk;
            }
            if (!drainSdk) {
                return;
            }
            for (const requestId of inflight) {
                cancel(drainSdk, requestId);
            }
            inflight.clear();
        },
        undrain() {
            draining = false;
            drainSdk = null;
        }
    };
}
const NO_IDLE_GC = { gcInterval: 0, gcIdleTicks: 1 };
export function resolveLoadOptions(opts = {}, deviceConfig = {}) {
    return {
        ctxSize: opts.ctxSize || deviceConfig.contextSize,
        kvCacheK: opts.kvCacheK ?? deviceConfig.kvCacheK,
        kvCacheV: opts.kvCacheV ?? deviceConfig.kvCacheV,
        projectionModel: opts.projectionModel,
        llama: deviceConfig.llama,
        slots: opts.slots ?? deviceConfig.slots
    };
}
export function modelKey(model, opts = {}) {
    return [
        model,
        opts.ctxSize ?? '',
        opts.kvCacheK ?? '',
        opts.kvCacheV ?? '',
        opts.projectionModel ?? '',
        opts.llama?.threads ?? '',
        opts.llama?.['batch-size'] ?? '',
        opts.llama?.['ubatch-size'] ?? '',
        opts.llama?.['kv-offload'] ?? '',
        opts.llama?.['n-cpu-moe'] ?? '',
        opts.slots && opts.slots > 1 ? opts.slots : ''
    ].join('\0');
}
class ModelPuddle extends ResourcePuddle {
}
function entryOf(pool, key) {
    return pool.resources.get(key);
}
export function modelOf(key) {
    return key.split('\0')[0];
}
let uses = 0;
export function releaseModel(pool, key) {
    if (pool.destroyed)
        return;
    const handle = entryOf(pool, key)?.value;
    if (handle) {
        handle.lastUsed = ++uses;
    }
    if (handle === undefined || !handle.loading) {
        pool.release(key);
        return;
    }
    const pending = handle.peek();
    if (pending === null) {
        pool.release(key);
        return;
    }
    const deferred = (deferredReleases.get(handle) ?? 0) + 1;
    deferredReleases.set(handle, deferred);
    if (deferred >= (entryOf(pool, key)?.refs ?? 0)) {
        handle.abandon();
    }
    const settle = () => {
        deferredReleases.set(handle, (deferredReleases.get(handle) ?? 1) - 1);
        releaseSettled(pool, key);
    };
    void pending.then(settle, settle);
}
const deferredReleases = new WeakMap();
function releaseSettled(pool, key) {
    if (pool.destroyed) {
        return;
    }
    pool.release(key);
}
export function loadedModels(pool) {
    const out = [];
    for (const entry of pool.resources.values()) {
        if (entry.value.peek() === null)
            continue;
        const model = modelOf(entry.id);
        const fit = entry.value.resource?.fit;
        out.push(fit ? { model, refs: entry.refs, fit } : { model, refs: entry.refs });
    }
    return out;
}
export function settledModels(pool) {
    const out = [];
    for (const entry of pool.resources.values()) {
        if (entry.value.peek() !== null && !entry.value.loading) {
            out.push(modelOf(entry.id));
        }
    }
    return out;
}
export function settledEntries(pool) {
    const out = [];
    for (const entry of pool.resources.values()) {
        const resource = entry.value.resource;
        if (resource !== null) {
            out.push({
                key: entry.id,
                refs: entry.refs,
                bytes: resource.bytes,
                lastUsed: entry.value.lastUsed
            });
        }
    }
    return out;
}
export function loadingModels(pool) {
    const out = [];
    for (const entry of pool.resources.values()) {
        if (entry.value.loading) {
            out.push(modelOf(entry.id));
        }
    }
    return out;
}
function reportedHandle({ notify, model, addon, hold, load }) {
    return new ModelHandle({
        load: async (signal) => {
            await hold?.(model, addon, signal);
            notify({ status: 'loading', model, catalogChanged: true });
            return load();
        },
        onLoaded: () => notify({ status: 'ready', model, catalogChanged: true }),
        onFailed: (err) => {
            if (err instanceof AbortedError)
                return;
            notify({ status: 'error', model, message: errorMessage(err), catalogChanged: true });
        }
    });
}
export async function leaseResidentModel(pool, wanted = () => true) {
    for (const entry of pool.resources.values()) {
        const key = entry.id;
        const pending = entry.value.peek();
        if (!pending || entry.value.loading || !wanted(key.split('\0')[0])) {
            continue;
        }
        pool.open(key);
        const loaded = await pending;
        return { model: loaded.model, modelId: loaded.modelId, release: () => releaseModel(pool, key) };
    }
    return null;
}
export function isResident(pool, key) {
    const handle = entryOf(pool, key)?.value;
    return handle !== undefined && handle.peek() !== null;
}
export function leaseCount(pool, key) {
    return entryOf(pool, key)?.refs ?? 0;
}
export async function evictIdle(pool) {
    for (let tick = 0; pool.idle > 0 && tick <= pool.gcIdleTicks; tick++) {
        await pool.gc();
    }
}
export async function evictIdleWhere(pool, wanted) {
    for (let tick = 0; tick <= pool.gcIdleTicks; tick++) {
        if (pool.destroyed)
            return;
        const held = [];
        for (const entry of pool.resources.values()) {
            if (entry.refs === 0 && !wanted(entry.id)) {
                held.push(entry.id);
            }
        }
        if (pool.idle === held.length) {
            return;
        }
        for (const key of held) {
            pool.open(key);
        }
        try {
            await pool.gc();
        }
        finally {
            for (const key of held) {
                releaseSettled(pool, key);
            }
        }
    }
}
function residentCount(pool, wanted) {
    let count = 0;
    for (const entry of pool.resources.values()) {
        if (wanted(entry.id) && entry.value.peek() !== null) {
            count++;
        }
    }
    return count;
}
export async function awaitModelCapacity(pool, { cap, deadlineMs, tickMs = 250, signal, evictable = () => true }) {
    const roomed = () => residentCount(pool, evictable) < cap;
    let done = false;
    let timer = null;
    const expired = new Promise((resolve) => {
        timer = setTimeout(() => {
            done = true;
            resolve(false);
        }, deadlineMs);
    });
    const evicting = (async () => {
        await evictIdleWhere(pool, evictable);
        while (!roomed()) {
            if (done || signal?.aborted)
                return false;
            await new Promise((resolve) => setTimeout(resolve, tickMs));
            if (done || signal?.aborted) {
                return false;
            }
            await evictIdleWhere(pool, evictable);
        }
        return true;
    })();
    try {
        return await Promise.race([evicting, expired]);
    }
    finally {
        done = true;
        if (timer !== null) {
            clearTimeout(timer);
        }
    }
}
export function evictModelWithin(pool, key, options) {
    return evictWhereWithin(pool, (candidate) => candidate === key, options);
}
export function evictIdleWithin(pool, key, { deadlineMs }) {
    const evicting = evictIdleWhere(pool, (candidate) => candidate === key).then(() => !isResident(pool, key));
    return raceTimeout(evicting, { ms: deadlineMs, fallback: false });
}
export function evictModel(pool, model, options) {
    return evictWhereWithin(pool, (key) => modelOf(key) === model, options);
}
async function evictWhereWithin(pool, wanted, { deadlineMs, tickMs = 250 }) {
    let done = false;
    const evicting = (async () => {
        while (residentCount(pool, wanted) > 0) {
            await evictIdleWhere(pool, wanted);
            if (residentCount(pool, wanted) === 0) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, tickMs));
            if (done) {
                return false;
            }
        }
        return true;
    })();
    try {
        return await raceTimeout(evicting, { ms: deadlineMs, fallback: false });
    }
    finally {
        done = true;
    }
}
function definedFields(config) {
    return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined));
}
function llmVerbosity() {
    const raw = Number(process.env.QVAC_LLM_VERBOSITY ?? 0);
    return raw === 1 || raw === 2 || raw === 3 ? raw : 0;
}
export function progressState(model, progress) {
    const transfer = transferProgress(progress);
    if (!transfer) {
        return { status: 'loading', model };
    }
    const { percentage, downloaded, total } = transfer;
    return percentage < 100
        ? { ...progress, status: 'downloading', model, percentage, downloaded, total }
        : { status: 'loading', model, percentage, downloaded, total };
}
const CLOCK_JUMP_MS = 250;
const CLOCK_SAMPLE_MS = 2_000;
function monotonicMs() {
    return Number(process.hrtime.bigint() / 1000000n);
}
export function loadClockGuard(model, sdk, { now = () => Date.now(), monoMs = monotonicMs, sampleMs = CLOCK_SAMPLE_MS, jumpMs = CLOCK_JUMP_MS } = {}) {
    let timer = null;
    const { promise: jumped, reject: fail } = Promise.withResolvers();
    let done = false;
    let abandoned = false;
    let lastWall = now();
    let lastMono = monoMs();
    const arm = () => {
        timer = setTimeout(sample, sampleMs);
        timer.unref?.();
    };
    const sample = () => {
        if (done)
            return;
        const wall = now();
        const mono = monoMs();
        if (wall - lastWall < mono - lastMono - jumpMs) {
            abandoned = true;
            fail(new HarnessError('MODEL_LOAD_CLOCK_SKEW', [model]));
            return;
        }
        lastWall = wall;
        lastMono = mono;
        arm();
    };
    arm();
    const race = async (pending) => {
        try {
            return await Promise.race([pending, jumped]);
        }
        catch (err) {
            if (abandoned && pending.requestId) {
                void sdk.cancel?.({ requestId: pending.requestId }).catch(noop);
            }
            throw err;
        }
        finally {
            done = true;
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    };
    return { race };
}
export function slotCount(model, { opts, deviceConfig }) {
    return deviceConfig.slotsFor?.(modelKey(model, opts)) ?? opts.slots ?? 1;
}
export function contextSize(model, modelSrc, { opts, deviceConfig }) {
    return (opts.ctxSize ||
        deviceConfig.contextFor?.(modelKey(model, opts)) ||
        defaultContextSize(modelSrc, customContextLength(model)));
}
export async function resolveCtxSize(loadSdk, model, load) {
    if (load.opts.ctxSize) {
        return load.opts.ctxSize;
    }
    const sdk = await loadSdk();
    return contextSize(model, await resolveModelSrc(sdk, model), load);
}
export function createModelPool(loadSdk, notify, { deviceConfig = {}, loads = createLoadTracker(), onUnloadFailure, beforeLoad, chooseContext, hold } = {}) {
    const load = async (key, model, opts) => {
        const sdk = await loadSdk();
        const modelSrc = await resolveModelSrc(sdk, model);
        const resolved = resolveLoadOptions(opts, deviceConfig);
        const slots = slotCount(model, { opts: resolved, deviceConfig });
        const projectionModelSrc = resolved.projectionModel
            ? await resolveProjectionSrc(sdk, resolved.projectionModel)
            : undefined;
        const mainGpu = deviceConfig.device !== 'cpu' && deviceConfig.mainGpu
            ? await deviceConfig.mainGpu()
            : undefined;
        const kvCache = adrenoSafeKvCache(deviceConfig.device, {
            k: resolved.kvCacheK,
            v: resolved.kvCacheV
        });
        const openclCache = deviceConfig.device !== 'cpu' && deviceConfig.openclCacheDir
            ? deviceConfig.openclCacheDir()
            : undefined;
        const placement = deviceConfig.device === 'cpu' ? deviceConfig.cpuPlacement?.() : undefined;
        const config = definedFields({
            ...resolved.llama,
            verbosity: llmVerbosity(),
            system_prompt: '',
            tools: true,
            stop_sequences: RUNAWAY_STOP_SEQUENCES,
            parallel: slots > 1 ? slots : undefined,
            'cache-type-k': kvCache.k,
            'cache-type-v': kvCache.v,
            projectionModelSrc,
            device: deviceConfig.device,
            gpu_layers: deviceConfig.gpuLayers,
            'main-gpu': mainGpu,
            openclCacheDir: openclCache || undefined,
            threads: resolved.llama?.threads ?? placement?.threads,
            'cpu-mask': placement?.mask
        });
        const pending = { key, model, modelSrc, modelType: 'llamacpp-completion' };
        const chosen = contextSize(model, modelSrc, { opts: resolved, deviceConfig });
        const ctxSize = resolved.ctxSize || !chooseContext
            ? chosen
            : await chooseContext({ ...pending, modelConfig: { ...config } }, chosen);
        const modelConfig = { ...config, ctx_size: ctxSize * slots };
        const { projectionModelSrc: projection, ...loggedConfig } = modelConfig;
        HarnessLog.debug('llm load config', { model, projection: Boolean(projection), ...loggedConfig });
        const admission = await beforeLoad?.({ ...pending, modelConfig });
        const loadStarted = Date.now();
        const modelId = await loadClockGuard(model, sdk)
            .race(loads.track(sdk.loadModel({
            modelSrc,
            modelType: 'llamacpp-completion',
            modelConfig,
            onProgress: (progress) => notify(progressState(model, progress))
        }), sdk))
            .finally(() => admission?.release());
        HarnessLog.info('llm loaded', { model, loadMs: Date.now() - loadStarted });
        return {
            model,
            modelId,
            ctxSize,
            slots,
            bytes: admission?.bytes,
            fit: await loadFit(sdk, model, modelId)
        };
    };
    return new ModelPuddle({
        open: (key, model = key, opts = {}) => reportedHandle({ notify, model, addon: 'llm', hold, load: () => load(key, model, opts) }),
        gc: unloadOnGc(loadSdk, notify, onUnloadFailure),
        ...NO_IDLE_GC
    });
}
export function createEmbedPool(loadSdk, notify, { faults, batchSize = DEFAULT_EMBED_BATCH_SIZE, openclCacheDir, loads = createLoadTracker(), onUnloadFailure, beforeLoad, hold }) {
    const load = async (key, model) => {
        const sdk = await loadSdk();
        const modelSrc = await resolveModelSrc(sdk, model, 'embeddings');
        const openclCache = faults.device !== 'cpu' && openclCacheDir ? openclCacheDir() : undefined;
        const modelConfig = {
            batchSize,
            gpuLayers: faults.gpuLayers(),
            device: faults.device,
            openclCacheDir: openclCache || undefined
        };
        const admission = await beforeLoad?.({
            key,
            model,
            modelSrc,
            modelType: 'llamacpp-embedding',
            modelConfig
        });
        const modelId = await loadClockGuard(model, sdk)
            .race(loads.track(sdk.loadModel({
            modelSrc,
            modelType: 'llamacpp-embedding',
            modelConfig,
            onProgress: (progress) => notify(progressState(model, progress))
        }), sdk))
            .finally(() => admission?.release());
        return { model, modelId, bytes: admission?.bytes, fit: await loadFit(sdk, model, modelId) };
    };
    return new ModelPuddle({
        open: (key, model = key) => reportedHandle({ notify, model, addon: 'embeddings', hold, load: () => load(key, model) }),
        gc: unloadOnGc(loadSdk, notify, onUnloadFailure),
        ...NO_IDLE_GC
    });
}
export function createVoicePool(loadSdk, notify, { modelType, addon, modelConfig, modelConfigFor, openclCacheDir, loads = createLoadTracker(), onUnloadFailure, beforeLoad, hold }) {
    const wantsGpu = modelConfig?.['useGPU'] === true;
    let gpuRefused = false;
    const load = async (key, model) => {
        const sdk = await loadSdk();
        const modelSrc = await resolveModelSrc(sdk, model, addon);
        const tuned = modelConfigFor?.(modelSrc);
        const loadConfig = tuned ? { ...modelConfig, ...tuned } : modelConfig;
        const admission = await beforeLoad?.({
            key,
            model,
            modelSrc,
            modelType,
            modelConfig: loadConfig
        });
        const attempt = () => {
            const config = gpuRefused ? { ...loadConfig, useGPU: false } : loadConfig;
            const openclCache = gpuRefused ? undefined : openclCacheDir?.();
            return loads.track(sdk.loadModel({
                modelSrc,
                modelType,
                modelConfig: openclCache ? { openclCacheDir: openclCache, ...config } : config,
                onProgress: (progress) => notify(progressState(model, progress))
            }), sdk);
        };
        const modelId = await loadClockGuard(model, sdk)
            .race(attempt().catch((err) => {
            if (!wantsGpu || gpuRefused || loads.draining)
                throw err;
            HarnessLog.warn('voice gpu load refused, retrying on cpu', {
                model,
                modelType,
                error: String(err)
            });
            gpuRefused = true;
            return attempt();
        }))
            .finally(() => admission?.release());
        return { model, modelId, bytes: admission?.bytes, fit: await loadFit(sdk, model, modelId) };
    };
    return new ModelPuddle({
        open: (key, model = key) => reportedHandle({ notify, model, addon, hold, load: () => load(key, model) }),
        gc: unloadOnGc(loadSdk, notify, onUnloadFailure),
        ...NO_IDLE_GC
    });
}
async function loadFit(sdk, model, modelId) {
    let probe;
    try {
        probe = (await sdk.getLoadedModelInfo?.({ modelId }))?.fitProbe;
    }
    catch (err) {
        HarnessLog.info('fit probe read failed', { model, err: errorMessage(err) });
        return undefined;
    }
    if (!probe) {
        return undefined;
    }
    const { verdict, reason, plan, projection } = probe;
    const fit = {
        verdict,
        reason,
        plan: plan && { nCtx: plan.nCtx, nGpuLayers: plan.nGpuLayers, nGpuDevices: plan.nGpuDevices },
        deviceBytes: projection?.deviceBytes,
        hostBytes: projection?.hostBytes
    };
    if (verdict === 'does-not-fit') {
        HarnessLog.info('loaded past a does-not-fit probe', { model, ...fit });
    }
    return fit;
}
function unloadOnGc(loadSdk, notify, onUnloadFailure) {
    return async (handles) => {
        const loadedHandles = [];
        for (const handle of handles) {
            const pending = handle.peek();
            if (pending === null) {
                continue;
            }
            try {
                loadedHandles.push(await pending);
            }
            catch { }
        }
        if (loadedHandles.length === 0) {
            return;
        }
        const reportFailure = (modelId, error) => {
            try {
                onUnloadFailure?.(modelId, error);
            }
            catch (callbackError) {
                HarnessLog.info('model unload failure observer failed', { error: String(callbackError) });
            }
        };
        let sdk;
        try {
            sdk = await loadSdk();
        }
        catch (error) {
            for (const { modelId } of loadedHandles) {
                reportFailure(modelId, error);
            }
            throw new ModelUnloadError(error);
        }
        let unloadError;
        let unloadFailed = false;
        for (const { model, modelId } of loadedHandles) {
            try {
                notify({ status: 'unloading', model });
            }
            catch (error) {
                HarnessLog.info('model unloading observer failed', { error: String(error) });
            }
            try {
                await sdk.unloadModel({ modelId });
            }
            catch (error) {
                HarnessLog.warn('unload failed', { model, err: errorMessage(error) });
                unloadError ??= error;
                unloadFailed = true;
                reportFailure(modelId, error);
                continue;
            }
            try {
                notify({ status: 'unloaded', model, catalogChanged: true });
            }
            catch (error) {
                HarnessLog.info('model unloaded observer failed', { error: String(error) });
            }
        }
        if (unloadFailed) {
            throw new ModelUnloadError(unloadError);
        }
    };
}
function noop() { }
