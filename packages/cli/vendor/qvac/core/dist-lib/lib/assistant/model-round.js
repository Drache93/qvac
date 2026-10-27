import b4a from 'b4a';
import { ToolSets } from '@qvac/harness';
import { AbortedError } from '@qvac/harness/race-abort';
import * as z from 'zod';
import { isRecord } from '../guards.js';
import { historyFromChunks, listHistoryChunks, replayFromChunks, runPromptView, sentTurn } from './history.js';
import { nameSenders, restoreSentContent } from './message.js';
import { isProbeRound, PROBE_KINDS } from '../probe-rounds.js';
const message = z.custom((value) => isRecord(value) && typeof value.role === 'string' && typeof value.content === 'string');
const record = () => z.custom((value) => isRecord(value));
const mediaRef = z.object({
    id: z.string(),
    page: z.number().optional(),
    frame: z.number().optional(),
    frames: z.number().optional()
});
const roundOptions = z.object({
    kind: z.enum(['streaming', 'wrap-up', ...PROBE_KINDS]),
    attempt: z.number(),
    modelId: z.string(),
    continuationNudge: z.string(),
    deliveredNudge: z.string(),
    toolSet: z.string().optional(),
    tools: z.array(record()).optional(),
    system: z.string().optional(),
    generationParams: record().optional(),
    responseFormat: record().optional(),
    toolDialect: z.custom().optional(),
    unforced: record().optional(),
    media: z.array(z.object({ at: z.number(), refs: z.array(mediaRef) })).optional()
});
const roundResult = z.custom((value) => isRecord(value) && typeof value.contentText === 'string' && isRecord(value.final));
export class OwnerRounds {
    port;
    inputLength = 0;
    share = null;
    _opts;
    _echoes = [];
    _known = null;
    _contextSent = false;
    _rounds = 0;
    _retakes = 0;
    constructor(opts) {
        this._opts = opts;
        this.port = (request, io) => this._round(request, io);
    }
    get rounds() {
        return this._rounds;
    }
    retook() {
        if (!this._retakes)
            return false;
        this._retakes--;
        return true;
    }
    echoed(type, text) {
        const at = this._echoes.findIndex((echo) => echo.type === type && echo.text === text);
        if (at === -1) {
            return false;
        }
        this._echoes.splice(at, 1);
        return true;
    }
    async _round(request, io) {
        if (io.signal.aborted)
            throw new AbortedError();
        const system = request.history[0]?.role === 'system' ? request.history[0].content : undefined;
        const input = (system === undefined ? 0 : 1) + this.inputLength;
        if (!this._contextSent) {
            this._contextSent = true;
            await this._sendContext(request, input);
        }
        const sent = {
            round: request.round,
            cacheKey: request.cacheKey,
            promptPrefix: request.promptPrefix,
            toolTurns: request.history.slice(input),
            options: await this._options(request, system)
        };
        const agentId = (await this._switchedTo()) ?? this._opts.agentId;
        const id = await this._ask(sent, agentId);
        this._rounds++;
        return this._follow(sent, { id, agentId }, io);
    }
    async probe({ kind, prompt, modelId, responseFormat, signal }) {
        if (signal.aborted)
            throw new AbortedError();
        const { engine, chatId, runId, deviceId } = this._opts;
        const agentId = (await this._switchedTo()) ?? this._opts.agentId;
        const { id } = await engine.appendChunk({
            chatId,
            runId,
            type: 'model-request',
            originDeviceId: deviceId,
            modelRequest: {
                round: 0,
                agents: [agentId],
                toolTurns: [{ role: 'user', content: prompt }],
                options: {
                    kind,
                    attempt: 0,
                    modelId: await this._modelOf(agentId, modelId),
                    continuationNudge: '',
                    deliveredNudge: '',
                    generationParams: { reasoning_budget: 0 },
                    responseFormat
                },
                state: 'open'
            }
        });
        return (await this._probed({ id, agentId }, signal)).contentText;
    }
    async _probed(asked, signal) {
        const { engine, chatId, from } = this._opts;
        const watch = engine.chunksDeltaWatch({ chatId, gte: from || undefined });
        const agents = engine.agentsWatch({});
        const abort = () => watch.destroy();
        signal.addEventListener('abort', abort);
        let round;
        let ended = false;
        void this._dropOnHostLoss(agents, asked, () => round).catch(noop);
        try {
            for await (const frame of watch) {
                round = frame.chunks?.find((chunk) => chunk.id === asked.id)?.modelRequest ?? round;
                ended = !!round && round.state !== 'open' && round.state !== 'taken';
                const result = roundEnd(round);
                if (result) {
                    return result;
                }
            }
            throw new AbortedError();
        }
        finally {
            signal.removeEventListener('abort', abort);
            watch.destroy();
            agents.destroy();
            if (!ended) {
                await engine.cancelModelRequest({ chunkId: asked.id }).catch(noop);
            }
        }
    }
    async _dropOnHostLoss(agents, asked, round) {
        let reachable = false;
        for await (const _frame of agents) {
            const agent = await this._opts.engine.getAgent({ agentId: asked.agentId }).catch(() => null);
            if (!agent) {
                continue;
            }
            const was = reachable;
            reachable = !!agent.hostReachable;
            const host = round()?.hostDeviceId;
            const moved = !!host && !b4a.equals(agent.providerDeviceId, host);
            if (moved || (was && !reachable && round()?.state === 'taken')) {
                await this._opts.engine.cancelModelRequest({ chunkId: asked.id }).catch(noop);
                return;
            }
        }
    }
    async _ask(sent, agentId) {
        const { engine, chatId, runId, deviceId } = this._opts;
        const modelId = await this._modelOf(agentId, sent.options.modelId);
        if (sent.options.media?.some(({ refs }) => refs.some((ref) => ref.frame !== undefined))) {
            await this.share?.(agentId);
        }
        const { id } = await engine.appendChunk({
            chatId,
            runId,
            type: 'model-request',
            originDeviceId: deviceId,
            modelRequest: {
                round: sent.round,
                agents: [agentId],
                cacheKey: sent.cacheKey,
                promptPrefix: sent.promptPrefix,
                toolTurns: sent.toolTurns,
                options: { ...sent.options, modelId },
                state: 'open'
            }
        });
        return id;
    }
    async _modelOf(agentId, modelId) {
        if (agentId === this._opts.agentId) {
            return modelId;
        }
        const agent = await this._opts.engine.getAgent({ agentId }).catch(() => null);
        return agent?.modelName || modelId;
    }
    async _switchedTo() {
        const { chunks } = await this._opts.engine.listChunks({
            chatId: this._opts.chatId,
            type: 'agent-switch'
        });
        return lastSwitch(chunks ?? [], this._opts.from);
    }
    async _sendContext(request, input) {
        const { engine, chatId, runId, deviceId } = this._opts;
        const sent = request.history.slice(0, input).findLast((turn) => turn.role === 'user');
        await engine.appendChunk({
            chatId,
            runId,
            type: 'context',
            originDeviceId: deviceId,
            context: { turn: { sent: sent?.content }, toolSetHash: request.toolSet ?? null }
        });
    }
    async _options(request, system) {
        const known = await this._knownSets();
        const options = {
            kind: request.kind,
            attempt: request.attempt,
            modelId: request.modelId,
            continuationNudge: request.continuationNudge,
            deliveredNudge: request.deliveredNudge,
            toolSet: request.toolSet,
            tools: request.toolSet && !known.toolSets.has(request.toolSet) ? request.tools : undefined,
            system: known.prefixes.has(request.promptPrefix) ? undefined : system,
            generationParams: request.generationParams,
            responseFormat: request.responseFormat,
            toolDialect: request.toolDialect,
            unforced: request.unforced,
            media: this._media(request.history)
        };
        known.prefixes.add(request.promptPrefix);
        if (request.toolSet) {
            known.toolSets.add(request.toolSet);
        }
        return options;
    }
    _media(history) {
        const media = history.flatMap((turn, at) => {
            const refs = (turn.attachments ?? []).flatMap(({ path }) => this._opts.media?.(path) ?? []);
            return refs.length ? [{ at, refs }] : [];
        });
        return media.length ? media : undefined;
    }
    _knownSets() {
        this._known ??= this._readKnownSets();
        return this._known;
    }
    async _readKnownSets() {
        const { chunks } = await this._opts.engine.listChunks({
            chatId: this._opts.chatId,
            type: 'model-request'
        });
        const known = { prefixes: new Set(), toolSets: new Set() };
        for (const chunk of withoutProbes(chunks ?? [])) {
            const options = roundOptions.safeParse(chunk.modelRequest?.options);
            const prefix = chunk.modelRequest?.promptPrefix;
            if (prefix && options.data?.system !== undefined) {
                known.prefixes.add(prefix);
            }
            if (options.data?.toolSet && options.data.tools) {
                known.toolSets.add(options.data.toolSet);
            }
        }
        return known;
    }
    async _follow(sent, first, io) {
        const { engine, chatId, from, deviceId } = this._opts;
        const watch = engine.chunksDeltaWatch({ chatId, gte: from || undefined });
        const agents = engine.agentsWatch({});
        const abort = () => watch.destroy();
        io.signal.addEventListener('abort', abort);
        const at = { asked: first, moving: null, host: null };
        const output = new RoundOutput(first.id, io, {
            forwarded: (echo) => this._echoes.push(echo),
            retook: () => this._retakes++
        });
        const move = async (agentId) => {
            at.moving = { agentId, after: output.newest(), emit: io.retake() };
            await engine.cancelModelRequest({ chunkId: at.asked.id }).catch(noop);
        };
        void this._followHost(agents, { at, output, move }).catch(noop);
        try {
            for await (const frame of watch) {
                const round = output.apply(frame);
                const result = at.moving ? undefined : roundEnd(round);
                if (result) {
                    return result;
                }
                const switched = output.switchedTo(from);
                if (!at.moving && switched && switched !== at.asked.agentId) {
                    await move(switched);
                }
                else if (at.moving && output.resetSince(at.moving.after, deviceId)) {
                    const { agentId, emit } = at.moving;
                    at.asked = { id: await this._ask(sent, agentId), agentId };
                    output.reask(at.asked.id, emit);
                    at.moving = null;
                }
            }
            throw new AbortedError();
        }
        finally {
            io.signal.removeEventListener('abort', abort);
            watch.destroy();
            agents.destroy();
            if (io.signal.aborted) {
                await engine.cancelModelRequest({ chunkId: at.asked.id }).catch(noop);
            }
        }
    }
    async _followHost(agents, { at, output, move }) {
        for await (const _frame of agents) {
            const agentId = at.asked.agentId;
            const agent = await this._opts.engine.getAgent({ agentId }).catch(() => null);
            if (!agent || at.asked.agentId !== agentId) {
                continue;
            }
            const provider = b4a.toHex(agent.providerDeviceId);
            const was = at.host;
            at.host = { provider, reachable: !!agent.hostReachable, moved: was?.moved };
            const host = output.round()?.hostDeviceId;
            if (!host || at.moving) {
                continue;
            }
            if (provider !== b4a.toHex(host)) {
                if (at.host.moved !== provider) {
                    at.host.moved = provider;
                    await move(agentId);
                }
                continue;
            }
            const lost = was?.provider === provider && was.reachable && !at.host.reachable;
            if (lost && output.round()?.state === 'taken') {
                await this._opts.engine.reopenModelRequest({ chunkId: at.asked.id }).catch(noop);
            }
        }
    }
}
export class RoundOutput {
    _id;
    _io;
    _hooks;
    _rows = new Map();
    _emitted = new Set();
    _emit;
    _taker = null;
    _takenAt = 0;
    _reopened = false;
    _resetAt = -1;
    constructor(id, io, hooks) {
        this._id = id;
        this._io = io;
        this._hooks = hooks;
        this._emit = io.emit;
    }
    apply(frame) {
        if (frame.reset) {
            this._rows.clear();
        }
        for (const gone of frame.removed ?? []) {
            this._rows.delete(gone);
        }
        for (const chunk of frame.chunks ?? []) {
            this._rows.set(chunk.id, chunk);
        }
        const asked = this._rows.get(this._id);
        const round = asked?.modelRequest;
        if (!asked || !round) {
            return undefined;
        }
        this._take(round.takenBy ?? null, round.takenAt ?? 0);
        const output = [...this._rows.values()].sort((a, b) => a.seq - b.seq);
        for (const chunk of output) {
            const reset = chunk.type === 'round-reset' && chunk.runId === asked.runId;
            if (reset && chunk.round === round.round) {
                this._resetAt = Math.max(this._resetAt, chunk.seq);
            }
        }
        for (const chunk of output) {
            this._forward(chunk);
        }
        return round;
    }
    reask(id, emit) {
        this._id = id;
        this._emit = emit;
        this._taker = null;
        this._takenAt = 0;
        this._reopened = false;
    }
    round() {
        return this._rows.get(this._id)?.modelRequest ?? undefined;
    }
    switchedTo(from) {
        return lastSwitch(this._rows.values(), from);
    }
    newest() {
        let seq = -1;
        for (const chunk of this._rows.values()) {
            seq = Math.max(seq, chunk.seq);
        }
        return seq;
    }
    resetSince(seq, deviceId) {
        const asked = this._rows.get(this._id);
        for (const chunk of this._rows.values()) {
            if (chunk.type === 'round-reset' &&
                chunk.seq > seq &&
                chunk.runId === asked?.runId &&
                chunk.round === asked?.modelRequest?.round &&
                b4a.equals(chunk.originDeviceId, deviceId)) {
                return true;
            }
        }
        return false;
    }
    _take(now, at) {
        if (this._taker && !now) {
            this._reopened = true;
        }
        const moved = now && this._taker && !b4a.equals(now, this._taker);
        if (now && this._taker && (this._reopened || moved || at !== this._takenAt)) {
            this._hooks.retook();
            this._emit = this._io.retake();
            this._reopened = false;
        }
        this._taker = now ?? this._taker;
        this._takenAt = now ? at : this._takenAt;
    }
    _forward(chunk) {
        const text = chunk.content?.text ?? chunk.thinking?.text;
        const type = chunk.type;
        const fresh = chunk.parentId === this._id && !this._emitted.has(chunk.id) && chunk.seq > this._resetAt;
        const taken = !this._reopened && this._taker && b4a.equals(chunk.originDeviceId, this._taker);
        if (!fresh || !taken || text === undefined || (type !== 'content' && type !== 'thinking')) {
            return;
        }
        this._emitted.add(chunk.id);
        this._hooks.forwarded({ type, text });
        this._emit({ type, text });
    }
}
export async function listRoundChunks(engine, chatId) {
    const [contexts, requests] = await Promise.all([
        engine.listChunks({ chatId, type: 'context' }),
        engine.listChunks({ chatId, type: 'model-request' })
    ]);
    return [...(contexts.chunks ?? []), ...withoutProbes(requests.chunks ?? [])].sort((a, b) => a.seq - b.seq);
}
function withoutProbes(rounds) {
    return rounds.filter((chunk) => !isProbeRound(chunk.modelRequest?.options));
}
export async function servedRequest(engine, round, media) {
    const { chatId, runId, modelRequest } = round;
    const options = roundOptions.safeParse(modelRequest?.options);
    if (!runId || !modelRequest || !options.success) {
        return null;
    }
    const { kind } = options.data;
    if (kind !== 'streaming' && kind !== 'wrap-up') {
        return probeRequest(runId, modelRequest, options.data);
    }
    const [all, rounds, { chunks: approvals }] = await Promise.all([
        listHistoryChunks(engine, chatId),
        listRoundChunks(engine, chatId),
        engine.listChunks({ chatId, type: 'approval-request' })
    ]);
    const request = all.find((chunk) => chunk.type === 'run-request' && chunk.runId === runId);
    const earlier = rounds.filter((chunk) => chunk.seq <= round.seq);
    const sent = earlier.findLast((chunk) => chunk.runId === runId && sentTurn(chunk) !== undefined);
    const prompt = sent && sentTurn(sent);
    const { system, tools } = carried(earlier, modelRequest.promptPrefix ?? '', options.data.toolSet);
    const toolTurns = z.array(message).safeParse(modelRequest.toolTurns ?? []);
    const unresolved = system === undefined || (options.data.toolSet && !tools);
    if (!request || prompt === undefined || unresolved || !toolTurns.success) {
        return null;
    }
    const view = runPromptView(all, approvals ?? [], { request, runId });
    const messages = historyFromChunks(view.history, view.stale, replayFromChunks(earlier));
    if (view.repair) {
        messages.push({ role: 'user', content: view.repair.promptText });
    }
    restoreSentContent(messages);
    const input = nameSenders(messages).map(({ role, content }) => ({ role, content }));
    const asked = input.findLastIndex((turn) => turn.role === 'user');
    if (asked !== -1) {
        input[asked] = { role: 'user', content: prompt };
    }
    const history = [
        ...(system === null ? [] : [{ role: 'system', content: system }]),
        ...input,
        ...toolTurns.data.map(({ attachments: _owners, ...turn }) => turn)
    ];
    await showMedia(history, {
        all,
        media: options.data.media ?? [],
        resolve: media && ((sources) => media(sources, options.data.modelId))
    });
    return {
        runId,
        round: modelRequest.round,
        kind,
        attempt: options.data.attempt,
        modelId: options.data.modelId,
        history,
        tools,
        toolSet: options.data.toolSet,
        generationParams: options.data.generationParams,
        responseFormat: options.data.responseFormat,
        toolDialect: options.data.toolDialect,
        cacheKey: modelRequest.cacheKey ?? undefined,
        promptPrefix: modelRequest.promptPrefix ?? '',
        continuationNudge: options.data.continuationNudge,
        deliveredNudge: options.data.deliveredNudge,
        unforced: options.data.unforced
    };
}
function probeRequest(runId, modelRequest, options) {
    const history = z.array(message).safeParse(modelRequest.toolTurns ?? []);
    if (!history.success) {
        return null;
    }
    return {
        runId,
        round: modelRequest.round,
        kind: 'streaming',
        attempt: options.attempt,
        modelId: options.modelId,
        history: history.data.map(({ role, content }) => ({ role, content })),
        generationParams: options.generationParams,
        responseFormat: options.responseFormat,
        promptPrefix: '',
        continuationNudge: options.continuationNudge,
        deliveredNudge: options.deliveredNudge
    };
}
async function showMedia(history, { all, media, resolve }) {
    const attachments = new Map();
    const digests = new Map();
    for (const { attachment, sourceId } of all) {
        if (!attachment || attachment.deletedAt) {
            continue;
        }
        if (!sourceId) {
            attachments.set(attachment.id, attachment);
        }
        else if (!digests.has(sourceId)) {
            digests.set(sourceId, attachment);
        }
    }
    const shown = media.flatMap(({ at, refs }) => refs.flatMap((ref) => {
        const attachment = attachments.get(ref.id);
        return attachment && history[at] ? [{ at, ref, attachment, digest: digests.get(ref.id) }] : [];
    }));
    const files = shown.length && resolve ? await resolve(shown) : [];
    shown.forEach(({ at }, i) => {
        const path = files[i];
        if (path) {
            history[at].attachments = [...(history[at].attachments ?? []), { path }];
        }
    });
}
function carried(rounds, promptPrefix, toolSet) {
    const sets = new ToolSets();
    let system;
    for (const chunk of rounds) {
        const options = roundOptions.safeParse(chunk.modelRequest?.options).data;
        if (options?.tools) {
            sets.add(options.tools);
        }
        if (options && chunk.modelRequest?.promptPrefix === promptPrefix && system === undefined) {
            system = options.system ?? null;
        }
    }
    return { system, tools: toolSet ? sets.resolve(toolSet) : undefined };
}
function roundEnd(round) {
    if (round?.state === 'done') {
        return roundResult.parse(round.result);
    }
    if (round?.state === 'failed') {
        throw new Error(round.reason || 'the model round failed');
    }
    if (round?.state === 'cancelled') {
        throw new AbortedError();
    }
    return undefined;
}
function lastSwitch(chunks, from) {
    let last;
    for (const chunk of chunks) {
        if (chunk.type === 'agent-switch' && chunk.seq > from && (!last || chunk.seq > last.seq)) {
            last = chunk;
        }
    }
    return last?.agentSwitch?.agentId;
}
function noop() { }
