import { HarnessError } from '../errors.js';
import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
import { ModelUnloadError } from '../models/model-pool.js';
import { trackCompletion } from './completion-run.js';
import { createHarnessLifecycle } from './machine.js';
export class Lifecycle {
    static trackCompletion = trackCompletion;
    _resource;
    _sdk;
    _loads;
    _releases;
    _models;
    _recreate;
    _statusChanged;
    _teardown;
    _machine = createHarnessLifecycle({
        suspend: () => this._suspendRuntimes(),
        resume: () => this._resumeRuntimes()
    });
    _completionRuns = new Set();
    _detachedRuns = new Set();
    _effectDrainWaiters = new Set();
    _activeWork = 0;
    _workDrainWaiters = new Set();
    _runtimeDraining = false;
    _runtimeUnloadFailed = false;
    _poolUnloadFailed = false;
    _poolCleanupFailed = false;
    _failedModelUnloads = new Set();
    _sdkClosed = false;
    _runtimesReleased = false;
    _closeRequested = false;
    constructor(opts) {
        this._resource = opts.resource;
        this._sdk = opts.sdk;
        this._loads = opts.loads;
        this._releases = opts.releases;
        this._models = opts.models;
        this._recreate = opts.recreate;
        this._statusChanged = opts.statusChanged;
        this._teardown = opts.teardown;
    }
    get suspended() {
        return this._machine.suspended;
    }
    get draining() {
        return this._runtimeDraining;
    }
    get unloadFailed() {
        return this._runtimeUnloadFailed;
    }
    get closeRequested() {
        return this._closeRequested;
    }
    requestClose() {
        this._closeRequested = true;
    }
    get opened() {
        return this._resource.opened;
    }
    get closing() {
        return this._resource.closing;
    }
    ready() {
        return this._resource.ready();
    }
    async send(type, { open = true } = {}) {
        if (!this._resource.opened) {
            if (open) {
                await this._resource.ready();
            }
        }
        if (this._closeRequested || this._resource.closing) {
            return;
        }
        await this._machine.send(type);
    }
    abortCompletions() {
        for (const run of this._completionRuns) {
            run.abort();
        }
    }
    assertNotClosing() {
        if (this._closeRequested || this._resource.closing || this._resource.closed) {
            throw new HarnessError('HARNESS_CLOSING');
        }
    }
    enterWork() {
        this.assertNotClosing();
        if (this._runtimeDraining) {
            throw new HarnessError('HARNESS_SUSPENDED');
        }
        if (this._runtimeUnloadFailed) {
            throw new Error('Runtime unload failed; close the harness before loading models again');
        }
        this._activeWork++;
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            if (--this._activeWork !== 0) {
                return;
            }
            for (const resolve of this._workDrainWaiters) {
                resolve();
            }
            this._workDrainWaiters.clear();
        };
    }
    trackCompletion(createSource, signal) {
        const tracked = trackCompletion(createSource, signal, (run) => {
            this._completionRuns.delete(run);
            this._notifyEffectDrain();
        });
        const { iterator, run } = tracked;
        this._completionRuns.add(run);
        return iterator;
    }
    trackDetachedRun(pending, runId) {
        const tracked = pending.catch((error) => {
            HarnessLog.info('detached completion effect failed', { runId, err: errorMessage(error) });
        });
        this._detachedRuns.add(tracked);
        void tracked
            .finally(() => {
            this._detachedRuns.delete(tracked);
            this._notifyEffectDrain();
        })
            .catch(noop);
    }
    recordModelUnloadFailure(modelId, error) {
        this._failedModelUnloads.add(modelId);
        this._poolUnloadFailed = true;
        this._runtimeUnloadFailed = true;
        HarnessLog.info('model unload failed', { modelId, err: errorMessage(error) });
    }
    recordPoolCleanupFailure() {
        this._poolCleanupFailed = true;
        this._poolUnloadFailed = true;
        this._runtimeUnloadFailed = true;
    }
    async close() {
        this._machine.cancelPending();
        this.abortCompletions();
        this._loads.drain();
        await this._machine.settled();
        await this.finishClose();
    }
    async finishClose() {
        let completed = false;
        try {
            const pending = this._sdk.peek();
            if (pending) {
                const sdk = await pending.catch(noop);
                if (sdk) {
                    this._loads.drain(sdk);
                }
            }
            await this._closeCompletions();
            await this._waitForEffectDrain();
            await this._waitForWorkDrain();
            await this._teardown();
            if (!this._runtimesReleased) {
                let released = await this._releaseRuntimes();
                if (!released && !this._poolUnloadFailed) {
                    released = await this._releaseRuntimes();
                }
                this._runtimesReleased = released;
            }
            let sdkCloseFailed = false;
            let sdkCloseError;
            const sdk = !this._sdkClosed && !this._runtimeUnloadFailed ? await this._sdk.peek()?.catch(noop) : null;
            if (sdk) {
                try {
                    await sdk.close();
                    this._sdkClosed = true;
                }
                catch (error) {
                    sdkCloseFailed = true;
                    sdkCloseError = error;
                    HarnessLog.info('sdk close failed', { err: errorMessage(error) });
                }
            }
            if (sdkCloseFailed) {
                throw sdkCloseError;
            }
            if (this._runtimeUnloadFailed) {
                throw new Error('Runtime unload failed; model cleanup could not be confirmed');
            }
            completed = true;
        }
        finally {
            if (completed) {
                this._machine.stop();
            }
        }
    }
    _waitForWorkDrain() {
        if (!this._activeWork) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this._workDrainWaiters.add(resolve));
    }
    _effectsSettled() {
        return !this._detachedRuns.size && ![...this._completionRuns].some((run) => run.started);
    }
    _notifyEffectDrain() {
        if (!this._effectsSettled())
            return;
        for (const resolve of this._effectDrainWaiters) {
            resolve();
        }
        this._effectDrainWaiters.clear();
    }
    _waitForEffectDrain() {
        if (this._effectsSettled()) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this._effectDrainWaiters.add(resolve));
    }
    async _closeCompletions(runs = this._completionRuns) {
        const closed = await Promise.allSettled([...runs].map((run) => run.close()));
        for (const outcome of closed) {
            if (outcome.status === 'rejected') {
                HarnessLog.info('completion close failed', {
                    err: errorMessage(outcome.reason)
                });
            }
        }
    }
    async _suspendRuntimes() {
        this._runtimeDraining = true;
        HarnessLog.info('suspending', { models: this._models() });
        this.abortCompletions();
        this._loads.drain();
        await this._closeCompletions([...this._completionRuns].filter((run) => run.started));
        await this._waitForEffectDrain();
        const pending = this._sdk.peek();
        if (pending) {
            const sdk = await pending.catch(noop);
            if (sdk) {
                this._loads.drain(sdk);
            }
        }
        await this._waitForWorkDrain();
        if (!(await this._releaseRuntimes())) {
            throw new Error('Runtime unload failed; close the harness before loading models again');
        }
        this._statusChanged();
        await this._sdkLifecycle('suspend');
        HarnessLog.info('suspended');
    }
    async _sdkLifecycle(op) {
        const sdk = await this._sdk.peek()?.catch(noop);
        if (!sdk) {
            return;
        }
        try {
            await sdk[op]();
        }
        catch (err) {
            HarnessLog.error(`sdk ${op} failed`, { err: errorMessage(err) });
            if (op === 'suspend') {
                throw err;
            }
            await sdk.resume().catch((retryErr) => {
                HarnessLog.error('sdk resume retry failed', {
                    err: errorMessage(retryErr)
                });
                throw retryErr;
            });
        }
    }
    async _releaseRuntimes() {
        const [pools, runtimes, plugins] = await Promise.all([
            Promise.allSettled(this._releases.pools()),
            Promise.allSettled(this._releases.runtimes()),
            this._releases.plugins()
        ]);
        for (const outcome of pools) {
            if (outcome.status === 'rejected' && !(outcome.reason instanceof ModelUnloadError)) {
                this._poolCleanupFailed = true;
            }
        }
        const others = [...runtimes, ...plugins];
        for (const outcome of [...pools, ...others]) {
            if (outcome.status !== 'rejected')
                continue;
            HarnessLog.warn('unload failed', { err: errorMessage(outcome.reason) });
        }
        const sdk = await this._sdk.peek()?.catch(noop);
        if (sdk) {
            for (const modelId of this._failedModelUnloads) {
                try {
                    await sdk.unloadModel({ modelId });
                    this._failedModelUnloads.delete(modelId);
                    this._statusChanged();
                }
                catch (error) {
                    HarnessLog.info('model unload retry failed', {
                        modelId,
                        err: errorMessage(error)
                    });
                }
            }
        }
        this._poolUnloadFailed = this._poolCleanupFailed || this._failedModelUnloads.size > 0;
        this._runtimeUnloadFailed =
            this._poolUnloadFailed || others.some((outcome) => outcome.status === 'rejected');
        return !this._runtimeUnloadFailed;
    }
    async _resumeRuntimes() {
        this.assertNotClosing();
        if (this._runtimeUnloadFailed) {
            throw new Error('Runtime unload failed; close the harness before loading models again');
        }
        HarnessLog.info('resuming', { pools: 'recreated' });
        this._loads.undrain();
        this._recreate();
        try {
            await this._sdkLifecycle('resume');
            this._runtimeDraining = false;
        }
        catch (error) {
            const sdk = await this._sdk.peek()?.catch(noop);
            if (sdk) {
                this._loads.drain(sdk);
            }
            await this._releaseRuntimes();
            throw error;
        }
    }
}
function noop() { }
