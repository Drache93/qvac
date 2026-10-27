import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import { createRagSourceTagFilter } from '../core/files/index.js';
import { errorMessage } from '../guards.js';
import { chatKvCacheKey } from '../kv-cache-reclaim.js';
import { meshScoped } from '../mesh-scoped-engine.js';
import { isProbeRound } from '../probe-rounds.js';
import { RunTranscript } from '../run-transcript.js';
import { servedRequest } from './model-round.js';
const LEFT = 'the round left this device';
const PLAIN_ID = /^[\w-]+(\/[\w-]+)*$/;
const REPAIR = /^\/r\d+$/;
export function servedCacheKey(round, ownerKey) {
    const { chatId, runId } = round;
    const agentId = round.modelRequest?.agents?.[0];
    const parts = [chatId, agentId, runId];
    if (!ownerKey || !agentId || !parts.every((part) => !!part && PLAIN_ID.test(part))) {
        return undefined;
    }
    const base = chatKvCacheKey(chatId);
    const repair = ownerKey.slice(base.length);
    const kept = ownerKey.startsWith(base) && REPAIR.test(repair) ? repair : '';
    return `${base}${kept}/a-${agentId}`;
}
export class RoundHost {
    _opts;
    _serving = new Map();
    _keys = new Map();
    _built = new Map();
    constructor(opts) {
        this._opts = opts;
    }
    async follow(meshId, frames) {
        for await (const { chunks } of frames) {
            this._reconcile(meshId, chunks ?? []);
        }
    }
    left(chatId, agentId) {
        const at = `${chatId}/${agentId}`;
        const keys = [...(this._built.get(at) ?? [])];
        this._built.delete(at);
        return keys;
    }
    stop() {
        for (const { controller } of this._serving.values()) {
            controller.abort(LEFT);
        }
    }
    _reconcile(meshId, rounds) {
        const me = this._opts.deviceId();
        for (const [id, serving] of this._serving) {
            const round = rounds.find((chunk) => chunk.id === id);
            const takenBy = round?.modelRequest?.takenBy;
            const stale = (round?.updatedAt ?? 0) < serving.takenAt;
            const open = round?.modelRequest?.state === 'open';
            const ours = takenBy ? b4a.equals(takenBy, me) : open && stale;
            if (serving.taken && !ours) {
                serving.controller.abort(LEFT);
                this._serving.delete(id);
            }
        }
        for (const round of rounds) {
            if (!this._serving.has(round.id)) {
                this._pick(meshId, round, me);
            }
        }
    }
    _pick(meshId, round, me) {
        const { state, takenBy, hostDeviceId } = round.modelRequest ?? {};
        if (hostDeviceId && !b4a.equals(hostDeviceId, me)) {
            return;
        }
        if (state === 'open' || (takenBy && b4a.equals(takenBy, me))) {
            this._serve(meshId, round);
        }
    }
    _serve(meshId, round) {
        const serving = {
            controller: new AbortController(),
            taken: false,
            takenAt: 0
        };
        this._serving.set(round.id, serving);
        const engine = meshScoped(this._opts.engine, meshId);
        this._take(engine, round, serving)
            .catch((err) => this._opts.log?.warn('rounds', 'round not served', { id: round.id, err }))
            .finally(() => {
            if (this._serving.get(round.id) === serving) {
                this._serving.delete(round.id);
            }
        });
    }
    async _take(engine, round, serving) {
        if (!(await this._provides(engine, round))) {
            return;
        }
        const { media } = this._opts;
        const { signal } = serving.controller;
        try {
            const request = await servedRequest(engine, round, media
                ? (sources, modelId) => media.resolve(sources, { id: round.id, modelId, signal })
                : undefined);
            if (!request || signal.aborted) {
                return;
            }
            if (await this._takeFor(engine, round, serving)) {
                serving.taken = true;
                await this._answer(engine, { round, request, serving });
            }
        }
        finally {
            media?.release(round.id);
        }
    }
    async _provides(engine, round) {
        if (round.modelRequest?.hostDeviceId) {
            return true;
        }
        for (const agentId of round.modelRequest?.agents ?? []) {
            const agent = await engine.getAgent({ agentId }).catch(() => null);
            if (agent && b4a.equals(agent.providerDeviceId, this._opts.deviceId())) {
                return true;
            }
        }
        return false;
    }
    async _answer(engine, { round, request, serving }) {
        const { signal } = serving.controller;
        if (isProbeRound(round.modelRequest?.options)) {
            return this._probe(engine, { round, request, serving });
        }
        const key = this._claimKey(round, request.cacheKey);
        const transcript = new RunTranscript(engine, {
            chatId: round.chatId,
            runId: request.runId,
            deviceId: this._opts.deviceId(),
            model: request.modelId,
            parentId: round.id,
            log: this._opts.log
        });
        const titles = await sourceTitles(engine, round);
        let tags = sourceTags(titles);
        let writing = Promise.resolve();
        const write = (type, text) => {
            if (text) {
                writing = writing.then(() => transcript.text(type, text, request.round));
            }
        };
        const emit = (event) => write(event.type, event.type === 'content' ? tags.push(event.text) : event.text);
        const retake = () => {
            tags = sourceTags(titles);
            writing = writing.then(async () => {
                await transcript.flush();
                await this._retake(engine, round, serving);
            });
            return emit;
        };
        const io = { signal, emit, retake };
        try {
            const result = await this._opts.serve({ ...request, cacheKey: key }, io);
            write('content', tags.flush());
            await writing;
            await transcript.flush();
            await engine.settleModelRequest({ chunkId: round.id, state: 'done', result });
        }
        catch (err) {
            if (signal.aborted) {
                return;
            }
            await writing.catch(noop);
            await transcript.flush().catch(noop);
            await engine.settleModelRequest({
                chunkId: round.id,
                state: 'failed',
                reason: errorMessage(err)
            });
        }
        finally {
            transcript.close();
            if (key && this._keys.get(key) === request.runId) {
                this._keys.delete(key);
            }
        }
    }
    async _probe(engine, { round, request, serving }) {
        const { signal } = serving.controller;
        const io = { signal, emit: noop, retake: () => noop };
        try {
            const result = await this._opts.serve(request, io);
            await engine.settleModelRequest({ chunkId: round.id, state: 'done', result });
        }
        catch (err) {
            if (!signal.aborted) {
                await engine.settleModelRequest({
                    chunkId: round.id,
                    state: 'failed',
                    reason: errorMessage(err)
                });
            }
        }
    }
    _claimKey(round, ownerKey) {
        const key = servedCacheKey(round, ownerKey);
        const runId = round.runId;
        if (!key || !runId) {
            return undefined;
        }
        const holder = this._keys.get(key);
        const claimed = holder !== undefined && holder !== runId ? `${key}/r-${runId}` : key;
        if (claimed === key) {
            this._keys.set(key, runId);
        }
        const at = `${round.chatId}/${round.modelRequest?.agents?.[0]}`;
        this._built.set(at, (this._built.get(at) ?? new Set()).add(claimed));
        return claimed;
    }
    async _retake(engine, round, serving) {
        if (!(await this._takeFor(engine, round, serving))) {
            serving.controller.abort(LEFT);
        }
    }
    async _takeFor(engine, round, serving) {
        const taken = (await engine.takeModelRequest({ chunkId: round.id })).modelRequest;
        const held = !!taken?.takenBy && b4a.equals(taken.takenBy, this._opts.deviceId());
        serving.takenAt = held ? (taken?.takenAt ?? 0) : serving.takenAt;
        return held;
    }
}
async function sourceTitles(engine, round) {
    const { chunks } = await engine.listChunks({ chatId: round.chatId, type: 'sources' });
    const retrieved = (chunks ?? []).find((chunk) => chunk.runId === round.runId);
    return retrieved?.sources?.sources.map((source) => source.title) ?? [];
}
function sourceTags(titles) {
    const filter = createRagSourceTagFilter();
    filter.add(titles);
    return filter;
}
function noop() { }
