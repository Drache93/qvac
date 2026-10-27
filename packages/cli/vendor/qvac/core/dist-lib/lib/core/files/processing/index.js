import { AbortController } from 'bare-abort-controller';
import {} from '../rag/index.js';
import { DeadlineScheduler } from '../../../deadline.js';
import { IndexingSource } from './source.js';
import { fileIds, fileRecord } from '../records/index.js';
import { FileDocument } from './document.js';
import { errorMessage } from '../../../guards.js';
export class FileProcessing {
    _mesh;
    _processor;
    _deviceId;
    _device;
    _source;
    _output;
    _progress;
    _lanes = [];
    _deadlines = new Map();
    _scheduler = new DeadlineScheduler(() => this._retry());
    _scanning = null;
    _dirty = false;
    _paused = false;
    _closed = false;
    _close = null;
    _indexCleared = true;
    _onDirty = (ids) => {
        if (ids) {
            void this.enqueue(ids);
        }
        else {
            this._kick();
        }
    };
    _onAll = () => this._kick();
    constructor(mesh, options) {
        this._mesh = mesh;
        this._processor = options.processor;
        this._deviceId = options.deviceId;
        this._device = options.device;
        this._progress = options.progress;
        const readBytes = mesh.files.readBytes.bind(mesh.files);
        const fetch = mesh.files.download.bind(mesh.files);
        this._source = new IndexingSource(readBytes, {
            log: mesh.log,
            retryMs: options.retryMs,
            retries: mesh.files.processorState(options.processor.id).sourceRetries,
            download: { fetch, ready: (id) => this._schedule(id, Date.now()) }
        });
        this._output = new IndexingSource(readBytes, {
            log: mesh.log,
            retryMs: options.retryMs,
            retries: mesh.files.processorState(options.processor.id).outputRetries,
            download: {
                fetch,
                ready: (id) => this._schedule(mesh.files.processorState(options.processor.id).artifact(id).knowledgeId ?? id, Date.now())
            }
        });
        this._lanes.push({ stage: 'produce', queue: new Map(), jobs: new Set() });
        if (options.processor.load) {
            this._lanes.push({ stage: 'load', queue: new Map(), jobs: new Set() });
        }
    }
    start() {
        this._mesh.on('indexing-dirty', this._onDirty);
        this._mesh.autobee.on('move-to', this._onAll);
        this._mesh.autobee.on('writable', this._onAll);
        this._kick();
    }
    async suspend() {
        this._paused = true;
        await this._stop();
    }
    resume() {
        if (this._closed)
            return;
        this._paused = false;
        this._kick();
    }
    reconnect() {
        this._source.reconnect((id, deadline) => this._schedule(id, deadline));
        this._output.reconnect((id, deadline) => this._schedule(this._mesh.files.processorState(this._processor.id).artifact(id).knowledgeId ?? id, deadline));
    }
    rescan() {
        this._kick();
    }
    close() {
        this._close ??= this._shutdown();
        return this._close;
    }
    get indexCleared() {
        return this._indexCleared;
    }
    async settle() {
        if (this._closed || this._paused)
            return;
        const ids = await this._documents();
        for (const lane of this._lanes) {
            await this._enqueue(ids, [lane], { wait: true });
        }
    }
    enqueue(ids, options = {}) {
        return this._enqueue(ids, this._lanes, options);
    }
    async _enqueue(ids, lanes, { wait = false } = {}) {
        if (this._closed || this._paused)
            return;
        const pending = [];
        for (const id of ids) {
            for (const lane of lanes) {
                let wakes = lane.queue.get(id);
                if (!wakes) {
                    lane.queue.set(id, (wakes = []));
                }
                if (wait) {
                    pending.push(new Promise((resolve) => wakes.push(resolve)));
                }
            }
        }
        for (const lane of lanes) {
            this._pump(lane);
        }
        await Promise.all(pending);
    }
    get active() {
        return !this._paused && !this._closed && !this._mesh.closing;
    }
    pending(id) {
        return (!this._paused &&
            !this._closed &&
            (this._lanes.some((lane) => lane.queue.has(id) || [...lane.jobs].some((job) => job.id === id)) ||
                this._source.pending((key) => key === id) ||
                this._output.pending((key) => this._mesh.files.processorState(this._processor.id).artifact(key).knowledgeId === id)));
    }
    prioritize(ids) {
        for (const lane of this._lanes) {
            const queued = new Map(lane.queue);
            lane.queue.clear();
            for (const id of ids) {
                lane.queue.set(id, queued.get(id) ?? []);
            }
            for (const [id, wakes] of queued) {
                if (!lane.queue.has(id)) {
                    lane.queue.set(id, wakes);
                }
            }
            this._pump(lane);
        }
    }
    async _shutdown() {
        this._closed = true;
        this._mesh.off('indexing-dirty', this._onDirty);
        this._mesh.autobee.off('move-to', this._onAll);
        this._mesh.autobee.off('writable', this._onAll);
        await this._stop();
        if (this._processor.load) {
            this._mesh.files.clearLoaded(this._processor.id);
        }
        this._indexCleared = await this._processor.close();
    }
    async _stop() {
        this._scheduler.clear();
        this._deadlines.clear();
        this._mesh.files.emit('update');
        const jobs = this._lanes.flatMap((lane) => [...lane.jobs]);
        for (const job of jobs) {
            job.abort.abort({
                type: this._closed ? 'file-processing-closed' : 'file-processing-suspended'
            });
        }
        await Promise.all([this._scanning, ...jobs.map((job) => job.done)]);
        await Promise.all([this._source.cancel(), this._output.cancel()]);
        for (const lane of this._lanes) {
            for (const wakes of lane.queue.values()) {
                for (const wake of wakes) {
                    wake();
                }
            }
            lane.queue.clear();
        }
    }
    _kick() {
        if (this._closed || this._paused)
            return;
        this._dirty = true;
        if (this._scanning) {
            return;
        }
        this._scanning = this._scan().finally(() => {
            this._scanning = null;
            if (this._dirty) {
                this._kick();
            }
        });
    }
    async _scan() {
        while (this._dirty && !this._closed && !this._paused) {
            this._dirty = false;
            try {
                await this.enqueue(await this._documents());
            }
            catch (err) {
                this._mesh.log?.warn('rag', 'file processing scan failed', { err });
            }
        }
    }
    async _documents() {
        if (this._mesh.closing)
            return [];
        const snap = this._mesh.view.snapshot();
        try {
            return await fileIds(snap, this._processor.input, this._processor.mediaKind);
        }
        finally {
            await snap.close();
        }
    }
    _pump(lane) {
        while (lane.queue.size && !this._closed && !this._paused && !this._mesh.closing) {
            const busy = [...lane.jobs];
            if (busy.length && (lane.stage !== 'produce' || busy.length > 1 || !busy[0].admitted)) {
                return;
            }
            const next = [...lane.queue].find(([queued]) => !busy.some((job) => job.id === queued));
            if (!next) {
                return;
            }
            const [id, wakes] = next;
            lane.queue.delete(id);
            const abort = new AbortController();
            const job = { id, abort, admitted: false, done: Promise.resolve() };
            lane.jobs.add(job);
            const admit = () => {
                if (job.admitted)
                    return;
                job.admitted = true;
                this._pump(lane);
            };
            job.done = this._run(lane, { id, wakes, signal: abort.signal, admit }).finally(() => {
                lane.jobs.delete(job);
                this._pump(lane);
            });
        }
    }
    async _forget(id) {
        const loaded = this._mesh.files.processorState(this._processor.id).forget(id)?.loaded;
        if (loaded) {
            await this._processor.evict?.(loaded);
        }
    }
    async _run(lane, { id, wakes, signal, admit }) {
        let produced = false;
        try {
            const record = await fileRecord(this._mesh.view, id, this._processor.input);
            if (!record && lane.stage === 'load') {
                await this._forget(id);
            }
            if (!record || record.deletedAt) {
                await this._source.cancel((key) => key === id);
                await this._output.cancel((key) => this._mesh.files.processorState(this._processor.id).artifact(key).knowledgeId === id);
            }
            if (!record || !this._processor.applies(record) || signal.aborted) {
                return;
            }
            if (lane.stage === 'produce' &&
                (!this._mesh.writable ||
                    !(await this._processor.canProduce(record, {
                        mesh: this._mesh,
                        deviceId: this._deviceId,
                        device: this._device
                    })))) {
                return;
            }
            const document = new FileDocument(this._mesh, {
                record,
                processor: this._processor,
                source: this._source,
                output: this._output,
                schedule: (deadline) => this._schedule(id, deadline),
                closed: () => this._closed,
                paused: () => this._paused,
                progress: this._progress,
                admit
            });
            if (signal.aborted) {
                return;
            }
            await this._processor[lane.stage]?.(document, signal);
            produced = lane.stage === 'produce';
        }
        catch (err) {
            if (!signal.aborted) {
                this._recordFailure(id, { stage: lane.stage, err });
            }
        }
        finally {
            if (produced && this.active) {
                this._queueLoad(id);
            }
            for (const wake of wakes) {
                wake();
            }
            this._mesh.files.emit('update');
        }
    }
    _recordFailure(id, { stage, err }) {
        const reason = errorMessage(err);
        if (stage === 'load') {
            this._mesh.files.load(id, { state: 'failed', reason }, {
                processorId: this._processor.id,
                artifactId: this._mesh.files.hydratedArtifact(id) ?? undefined
            });
        }
        else {
            this._mesh.files.work(id, { state: 'failed', reason }, this._processor.id);
        }
        this._mesh.log?.warn('rag', 'file processing failed', { id, stage, err });
    }
    _queueLoad(id) {
        const loader = this._lanes.find((entry) => entry.stage === 'load');
        if (!loader) {
            return;
        }
        if (!loader.queue.has(id)) {
            loader.queue.set(id, []);
        }
        this._pump(loader);
    }
    _schedule(id, deadline) {
        if (this._closed || this._paused)
            return;
        const previous = this._deadlines.get(id);
        if (previous === undefined || deadline < previous) {
            this._deadlines.set(id, deadline);
        }
        this._scheduler.schedule(deadline);
    }
    _retry() {
        const ids = [];
        for (const [id, deadline] of this._deadlines) {
            if (deadline <= Date.now()) {
                this._deadlines.delete(id);
                ids.push(id);
            }
            else {
                this._scheduler.schedule(deadline);
            }
        }
        void this.enqueue(ids);
    }
}
export { isClaimLive, listIndexingByChat, listIndexingByKnowledge } from './protocol.js';
export { FileState } from './state.js';
export { settleFiles } from './settle.js';
