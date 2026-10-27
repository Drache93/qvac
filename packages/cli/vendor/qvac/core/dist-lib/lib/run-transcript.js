import { WriteQueue } from './write-queue.js';
const COALESCE_CAP = 8192;
const FLUSH_INTERVAL_MS = 250;
const SLOW_WRITE_MS = 5000;
const TRANSCRIPT = 'transcript';
const STATUS = 'status';
export class RunTranscript {
    _engine;
    _chatId;
    _runId;
    _deviceId;
    _model;
    _parentId;
    _log;
    _writes;
    _ticker;
    _announced = new Set();
    _buffered = null;
    constructor(engine, opts) {
        const { chatId, runId, deviceId, model, parentId, log } = opts;
        this._engine = engine;
        this._chatId = chatId;
        this._runId = runId;
        this._deviceId = deviceId;
        this._model = model;
        this._parentId = parentId;
        this._log = log ?? null;
        this._writes = new WriteQueue({
            slowMs: SLOW_WRITE_MS,
            onSlow: (info) => this._log?.warn('runs', 'write still pending', { runId, ...info })
        });
        this._ticker = setInterval(() => {
            this.flush().catch((err) => this._log?.error('assistant', 'content flush failed', err));
        }, FLUSH_INTERVAL_MS);
    }
    async text(type, text, round) {
        if (this._buffered && (this._buffered.type !== type || this._buffered.round !== round)) {
            await this.flush();
        }
        if (!this._buffered) {
            this._buffered = { type, text: '', round };
            this._announce(type);
        }
        this._buffered.text += text;
        if (this._buffered.text.length >= COALESCE_CAP) {
            await this.flush();
        }
    }
    chunk(chunk) {
        return this._writes.run(TRANSCRIPT, `append:${chunk.type}`, () => this._engine.appendChunk({
            chatId: this._chatId,
            runId: this._runId,
            originDeviceId: this._deviceId,
            ...chunk
        }));
    }
    async roundReset(round, replacedTypes) {
        await this.flush();
        await this._writes.run(TRANSCRIPT, 'append:round-reset', () => this._engine.appendChunk({
            chatId: this._chatId,
            runId: this._runId,
            type: 'round-reset',
            round,
            roundReset: { replacedTypes: [...replacedTypes] },
            originDeviceId: this._deviceId
        }));
    }
    status(runStatus, { resumed = false } = {}) {
        this._log?.info('runs', `run ${runStatus.state}`, {
            runId: this._runId,
            chatId: this._chatId,
            reason: runStatus.reason || undefined
        });
        return this._writes.run(STATUS, `status:${runStatus.state}`, () => this._engine.appendChunk({
            chatId: this._chatId,
            runId: this._runId,
            type: 'run-status',
            runStatus: { ...runStatus, model: this._model },
            resumed: resumed || undefined,
            originDeviceId: this._deviceId
        }));
    }
    progress(id, runStatus) {
        return this._writes.run(TRANSCRIPT, 'update:run-status', () => this._engine.updateChunk({ chunkId: id, runStatus: { ...runStatus, model: this._model } }));
    }
    flush() {
        return this._writes.run(TRANSCRIPT, 'append:text', async () => {
            if (!this._buffered)
                return;
            const { type, text, round } = this._buffered;
            this._buffered = null;
            const started = Date.now();
            await this._engine.appendChunk({
                chatId: this._chatId,
                runId: this._runId,
                type,
                round,
                parentId: this._parentId,
                content: type === 'content' ? { text } : null,
                thinking: type === 'thinking' ? { text } : null,
                originDeviceId: this._deviceId
            });
            const ms = Date.now() - started;
            if (ms > FLUSH_INTERVAL_MS) {
                this._log?.warn('runs', 'slow content flush', {
                    runId: this._runId,
                    ms,
                    chars: text.length
                });
            }
        });
    }
    pending() {
        return this._writes.pending();
    }
    close() {
        clearInterval(this._ticker);
    }
    _announce(type) {
        if (this._announced.has(type))
            return;
        this._announced.add(type);
        this._log?.info('runs', `${type} started`, { runId: this._runId });
    }
}
