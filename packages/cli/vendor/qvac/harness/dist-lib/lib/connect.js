import b4a from 'b4a';
import { randomBytes } from 'crypto';
import EventEmitter from 'events';
import fs from 'fs';
import { z } from 'zod';
import { HarnessError } from './errors.js';
import { settleOnClose } from './rpc-session.js';
import { harnessClient } from '../spec/calls.js';
import HRPC from '../spec/hrpc/index.js';
import { encode } from '../spec/hrpc/messages.js';
import { unsupportedKvCacheDeletion } from './capabilities/kv-cache.js';
import { checkGoal, checkMaxToolRounds } from './capabilities/tool-turns.js';
import { Agent } from './agent/index.js';
import { readModelSourcePreview } from './capabilities/preview-model-source.js';
import { RunLog } from './run-log/index.js';
import { AbortedError } from './helpers/engine-error.js';
import { RoundHost } from './round-host.js';
import { HarnessLog } from './log.js';
import { assertEmbedDevice } from './models/embed-config.js';
import { addonTaskType } from './models/model-task.js';
import { errorCode, errorMessage, isRecord } from './guards.js';
import { pushQueue } from './queue.js';
import { stageFile, sweepStaging } from './staging.js';
import { sweepSpill } from './spill.js';
import { readInstall, readSetup } from './tools/skills/manifest-parse.js';
import { SKILL_STATE } from './tools/skills/skill-state.js';
import { asToolset } from './tools/toolsets.js';
import { fromDownloadWire, roundResultFrom, fromKnowledgeHitWire, fromKnowledgeStatusWire, fromKnowledgeUpsertResultWire, fromWire, toKnowledgeUpsertWire, unpackVectors } from './wire.js';
export const HARNESS_DIED = 'HARNESS_DIED';
const PAUSE_GRACE_MS = 10_000;
export function connectHarness(transport, options = {}) {
    return new RemoteHarness(transport, options);
}
export function readEmbeddingDeviceResponse(response) {
    const device = isRecord(response) ? response.device : undefined;
    if (typeof device !== 'string') {
        throw new Error('invalid embedding device response');
    }
    assertEmbedDevice(device);
    return device;
}
export class RemoteHarness extends EventEmitter {
    _transport;
    _session = null;
    _opening = null;
    _closed = false;
    _pauseGraceMs;
    _runLogReleaseTimeoutMs;
    _customModels = [];
    constructor(transport, options = {}) {
        super();
        this._transport = transport;
        this._pauseGraceMs = options.pauseGraceMs ?? PAUSE_GRACE_MS;
        this._runLogReleaseTimeoutMs = options.runLogReleaseTimeoutMs ?? 5000;
    }
    _ensure() {
        if (this._closed) {
            return Promise.reject(died('harness closed'));
        }
        if (this._session) {
            return this._session.dead
                ? Promise.reject(died('harness is dead'))
                : Promise.resolve(this._session);
        }
        this._opening ??= this._open();
        return this._opening;
    }
    async _open() {
        sweepStaging();
        sweepSpill();
        let stream;
        try {
            stream = await this._transport();
        }
        catch (err) {
            const details = errorDetails(err);
            this.emit('status', { state: 'died', ...details });
            throw died(`harness failed to open: ${details.error}`);
        }
        if (this._closed) {
            stream.destroy();
            throw died('harness closed');
        }
        const session = {
            client: harnessClient(settleOnClose(new HRPC(stream))),
            stream,
            dead: false
        };
        let streamError = null;
        stream.on('error', (err) => {
            streamError = err;
        });
        stream.on('close', () => {
            session.dead = true;
            if (this._closed) {
                return;
            }
            this.emit('status', streamError ? { state: 'died', ...errorDetails(streamError) } : { state: 'died' });
        });
        this._session = session;
        this.emit('status', { state: 'running' });
        const models = session.client.modelEvents({});
        models.on('data', (state) => this.emit('model', state.loaded ? { ...state, loaded: state.loaded.map(loadedModel) } : state));
        models.on('error', noop);
        if (this._customModels.length) {
            try {
                await session.client.setCustomModels({ models: this._customModels });
            }
            catch (err) {
                HarnessLog.warn('custom model restore failed', { message: errorMessage(err) });
            }
        }
        return session;
    }
    completion(context) {
        return context.agents
            ? Agent.follow({ completion: (hop) => this._hop(hop) }, { ...context, goal: undefined })
            : this._hop(context);
    }
    async *_hop(context) {
        const runId = context.runId ?? b4a.toHex(randomBytes(16));
        if (context.signal?.aborted) {
            yield { type: 'aborted', runId };
            return;
        }
        const explicitEmptyIdentity = explicitEmptyIdentityFields(context);
        const payload = {
            resume: context.resume === true,
            recoveryEvents: true,
            resolutions: context.recovery
        };
        if (explicitEmptyIdentity.length) {
            payload.explicitEmptyIdentity = explicitEmptyIdentity;
        }
        if (context.knowledge) {
            payload.knowledge = { scopes: [...context.knowledge.scopes] };
        }
        if (context.planMode) {
            payload.planMode = true;
        }
        if (context.deferTools) {
            payload.deferTools = true;
        }
        if (context.parentRunId) {
            payload.parentRunId = context.parentRunId;
        }
        if (context.goal) {
            payload.goal = checkGoal({ ...context.goal }, context.responseFormat);
        }
        if (context.typedText !== undefined) {
            payload.typedText = context.typedText;
        }
        if (context.replaysContext) {
            payload.replaysContext = true;
        }
        if (context.modelRound) {
            payload.modelRound = true;
        }
        if (context.roundCut) {
            payload.roundCut = true;
        }
        if (context.maxToolRounds !== undefined && context.maxToolRounds !== 0) {
            payload.maxToolRounds = checkMaxToolRounds(context.maxToolRounds);
        }
        yield* this._run({
            type: 'start',
            runId,
            payload,
            model: context.model,
            agent: context.agent ? knobs(context.agent) : undefined,
            cacheKey: context.cacheKey,
            session: context.session,
            thinkingDefault: context.thinkingDefault,
            generationParams: context.generationParams,
            responseFormat: context.responseFormat,
            captureInferenceCalls: context.captureInferenceCalls,
            messages: context.messages?.map(({ role, content, attachments, toolCalls, toolCallId, name, id, context: added, sentAt }) => ({
                role,
                content,
                attachments: attachments?.map(({ path: file }) => ({ path: file })),
                toolCalls,
                toolCallId,
                name,
                id,
                context: added,
                sentAt
            })),
            toolConfigs: context.toolConfigs,
            grantedDirs: context.grantedDirs,
            grantedDrives: context.grantedDrives,
            grantedWriteDirs: context.grantedWriteDirs
        }, { ...context, runId });
    }
    async serveModelRound(request, io) {
        const aborted = abortedRound(io.signal);
        const { client } = await Promise.race([this._ensure(), aborted]);
        const duplex = client.completion();
        const stop = () => duplex.destroy();
        io.signal?.addEventListener?.('abort', stop, { once: true });
        try {
            const frame = { type: 'model-round-ask', payload: request };
            encode('@harness/completion-frame', frame);
            duplex.write(frame);
            const served = servedRound(frames(duplex), io);
            served.catch(noop);
            return await Promise.race([served, aborted]);
        }
        finally {
            io.signal?.removeEventListener?.('abort', stop);
            duplex.destroy();
        }
    }
    async *invoke(context) {
        const agent = context.agent ?? {};
        yield* this._run({
            type: 'invoke',
            capability: context.capability,
            arguments: context.args,
            enhance: context.enhance,
            agent: knobs(agent)
        }, {
            model: '',
            agent,
            messages: [],
            attach: context.attach,
            fetchAttachment: context.fetchAttachment,
            progress: context.progress,
            signal: context.signal
        });
    }
    async *_run(open, context) {
        if (context.signal?.aborted) {
            yield { type: 'aborted', runId: context.runId ?? open.runId ?? undefined };
            return;
        }
        let session;
        try {
            session = await awaitWithAbort(this._ensure(), context.signal);
        }
        catch (err) {
            if (context.signal?.aborted) {
                yield { type: 'aborted', runId: context.runId ?? open.runId ?? undefined };
                return;
            }
            throw err;
        }
        const { client } = session;
        let pausable = false;
        const peer = this.capability().then((c) => {
            pausable = c.hostRunLog === true && c.hostRunLogVersion === 1;
            return c;
        }, () => null);
        const canResume = async () => {
            const c = await peer;
            return context.runLog
                ? c?.hostRunLog === true && c.hostRunLogVersion === 1
                : c?.completionRecovery === true;
        };
        let capability;
        try {
            capability = await awaitWithAbort(peer, context.signal);
        }
        catch (err) {
            if (context.signal?.aborted) {
                yield { type: 'aborted', runId: context.runId ?? open.runId ?? undefined };
                return;
            }
            throw err;
        }
        if (context.runLog && (capability?.hostRunLog !== true || capability.hostRunLogVersion !== 1)) {
            throw new Error('This peer does not support a host-owned run log');
        }
        if (context.resume && !(await canResume())) {
            throw new Error('This peer does not support persistent completion recovery');
        }
        let activeRunId = context.runId ?? open.runId ?? undefined;
        if (context.signal?.aborted) {
            yield { type: 'aborted', runId: activeRunId };
            return;
        }
        const leasedRunId = context.runLog ? activeRunId : undefined;
        if (context.runLog && !leasedRunId) {
            throw new Error('host-owned run log requires a run id');
        }
        let hostLease;
        let duplex = null;
        let startFrame = open;
        let emittedAborted = false;
        const staged = [];
        let closed = false;
        let received = 0;
        const reclaim = () => {
            for (const file of staged.splice(0).reverse()) {
                void fs.promises.unlink(file).catch(noop);
            }
        };
        let pauseTimer;
        let started = false;
        const rounds = context.modelRound &&
            new RoundHost(context.modelRound, (frame) => {
                if (!closed) {
                    send({ ...frame });
                }
            });
        let failure = null;
        const send = (frame) => {
            if (!duplex)
                return false;
            try {
                encode('@harness/completion-frame', frame);
            }
            catch (err) {
                failure ??= new Error(`cannot encode ${String(frame.type)} frame: ${errorMessage(err)}`);
                duplex.destroy(failure);
                return false;
            }
            duplex.write(frame);
            return true;
        };
        const onAbort = () => {
            if (!pausable || !duplex || !started) {
                return duplex?.destroy();
            }
            send({ type: 'pause' });
            pauseTimer = setTimeout(() => duplex?.destroy(), this._pauseGraceMs);
        };
        try {
            if (context.runLog) {
                const leaseResult = await acquireHostRunLogLease(context.runLog, leasedRunId, context.signal);
                if (leaseResult === null) {
                    yield { type: 'aborted', runId: activeRunId };
                    return;
                }
                hostLease = leaseResult;
            }
            if (hostLease) {
                validateHostRunLogLease(hostLease, leasedRunId);
                const payload = isRecord(open.payload) ? { ...open.payload } : {};
                payload.resume =
                    context.resume === true ||
                        (hostLease.boot !== undefined && hostLease.boot.metadata !== null);
                payload.runLog = {
                    boot: hostLease.boot ?? null,
                    digestKey: b4a.toHex(hostLease.digestKey),
                    hostAppendTimeoutMs: context.hostAppendTimeoutMs
                };
                startFrame = { ...open, payload };
            }
            if (context.signal?.aborted) {
                yield { type: 'aborted', runId: activeRunId };
                return;
            }
            context.signal?.addEventListener?.('abort', onAbort, { once: true });
            duplex = client.completion();
            if (context.signal?.aborted) {
                duplex.destroy();
                yield { type: 'aborted', runId: activeRunId };
                return;
            }
            if (!send(startFrame)) {
                throw failure;
            }
            started = true;
            context.roundCut?.((note) => {
                if (!closed) {
                    send({ type: 'round-cut', message: note });
                }
            });
            if (context.input) {
                void sendInput(context.input, (item) => {
                    if (closed)
                        return false;
                    return send({
                        type: item.mode,
                        callId: item.id,
                        messages: [{ role: 'user', content: item.text }]
                    });
                }).catch(noop);
            }
            HarnessLog.debug('client wire open', { model: context.model, capability: open.capability });
            for await (const event of frames(duplex)) {
                received++;
                if (event.type !== 'content' && event.type !== 'thinking') {
                    HarnessLog.debug('client frame', { type: event.type, n: received });
                }
                if (event.type === 'run-started' || event.type === 'run-resumed') {
                    activeRunId = event.runId ?? activeRunId;
                }
                if (event.type === 'done') {
                    break;
                }
                if (event.type === 'approval-ask') {
                    const callId = event.callId;
                    const approval = approvalCall(event);
                    void Promise.resolve()
                        .then(() => context.approve?.(approval))
                        .then((approved) => {
                        if (!closed) {
                            send({ type: 'decision', callId, approved: approved === true });
                        }
                    }, () => {
                        if (!closed) {
                            send({ type: 'decision', callId, approved: false });
                        }
                    })
                        .catch((err) => HarnessLog.warn('approval reply failed', { callId, message: errorMessage(err) }));
                    continue;
                }
                if (event.type === 'attach-ask') {
                    const callId = event.callId;
                    void bridgeAttach(event, context.attach)
                        .then((frame) => {
                        if (!closed) {
                            send({ ...frame, callId });
                        }
                    }, (err) => {
                        if (!closed) {
                            send({
                                type: 'attach-result',
                                callId,
                                message: errorMessage(err)
                            });
                        }
                    })
                        .catch((err) => HarnessLog.warn('attach reply failed', { callId, message: errorMessage(err) }));
                    continue;
                }
                if (event.type === 'fetch-ask') {
                    const callId = event.callId;
                    void bridgeFetch(event, context, staged)
                        .then((frame) => {
                        if (closed) {
                            return reclaim();
                        }
                        send({ ...frame, callId });
                    }, (err) => {
                        if (closed) {
                            return reclaim();
                        }
                        send({ type: 'fetch-result', callId, message: errorMessage(err) });
                    })
                        .catch((err) => HarnessLog.warn('fetch reply failed', { callId, message: errorMessage(err) }));
                    continue;
                }
                if (event.type === 'drive-ask') {
                    const callId = event.callId;
                    void bridgeDrive(event, context)
                        .then((frame) => {
                        if (!closed) {
                            return send({ ...frame, callId });
                        }
                        const stagedPath = frame.payload?.path;
                        if (stagedPath) {
                            void fs.promises.unlink(stagedPath).catch(noop);
                        }
                    }, (err) => {
                        if (!closed) {
                            send({
                                type: 'drive-result',
                                callId,
                                message: errorMessage(err)
                            });
                        }
                    })
                        .catch((err) => HarnessLog.warn('drive reply failed', { callId, message: errorMessage(err) }));
                    continue;
                }
                if (event.type === 'run-log-append') {
                    const callId = event.callId;
                    void bridgeRunLog({
                        event,
                        context,
                        runId: leasedRunId,
                        generation: hostLease?.generation
                    })
                        .then((frame) => {
                        if (!closed) {
                            send({ ...frame, callId });
                        }
                    }, (err) => {
                        if (!closed) {
                            send({
                                type: 'run-log-result',
                                callId,
                                message: errorMessage(err)
                            });
                        }
                    })
                        .catch((err) => HarnessLog.warn('run-log reply failed', { callId, message: errorMessage(err) }));
                    continue;
                }
                if (event.type === 'question-ask') {
                    answerQuestion(event, {
                        askUser: context.askUser,
                        reply: (frame) => {
                            if (!closed) {
                                send(frame);
                            }
                        }
                    });
                    continue;
                }
                if (event.type === 'progress') {
                    context.progress?.(event.cleared ? null : { percentage: event.percentage ?? 0 });
                    continue;
                }
                if (event.type === 'model-round-ask') {
                    rounds?.ask(event.callId ?? '', event.payload);
                    continue;
                }
                if (event.type === 'model-round-cancel') {
                    rounds?.cancel(event.callId ?? '');
                    continue;
                }
                const wire = fromWire(event);
                if (wire.type === 'aborted' || wire.type === 'paused') {
                    emittedAborted = true;
                }
                yield wire;
            }
            HarnessLog.info('client wire ended', { received });
        }
        catch (err) {
            if (failure) {
                throw failure;
            }
            if (context.signal?.aborted) {
                if (!emittedAborted) {
                    yield { type: 'aborted', runId: activeRunId };
                }
                return;
            }
            if (!started) {
                throw err;
            }
            throw died(`harness died mid-run: ${errorMessage(err)}`);
        }
        finally {
            HarnessLog.debug('client run end', { received, aborted: Boolean(context.signal?.aborted) });
            context.signal?.removeEventListener?.('abort', onAbort);
            clearTimeout(pauseTimer);
            duplex?.destroy();
            closed = true;
            rounds?.close();
            reclaim();
            if (hostLease && leasedRunId && context.runLog) {
                let timer;
                try {
                    await Promise.race([
                        context.runLog.release(leasedRunId, hostLease.generation),
                        new Promise((_resolve, reject) => {
                            timer = setTimeout(() => reject(new Error('host run-log release timed out')), this._runLogReleaseTimeoutMs);
                        })
                    ]);
                }
                catch (err) {
                    HarnessLog.info('host run-log release failed', {
                        runId: leasedRunId,
                        message: errorMessage(err)
                    });
                }
                finally {
                    clearTimeout(timer);
                }
            }
        }
        if (context.signal?.aborted && !emittedAborted) {
            yield { type: 'aborted', runId: activeRunId };
        }
    }
    async *download(context) {
        const { client } = await this._ensure();
        let stream = null;
        let emittedAborted = false;
        const onAbort = () => stream?.destroy();
        try {
            stream = client.download({
                model: context.model,
                addon: context.addon,
                seed: context.seed
            });
            if (context.signal?.aborted) {
                stream.destroy();
                yield { type: 'aborted' };
                return;
            }
            context.signal?.addEventListener?.('abort', onAbort, { once: true });
            for await (const event of downloadFrames(stream)) {
                const wire = fromDownloadWire(event);
                if (wire.type === 'aborted') {
                    emittedAborted = true;
                }
                yield wire;
            }
        }
        catch (err) {
            if (context.signal?.aborted) {
                if (!emittedAborted) {
                    yield { type: 'aborted' };
                }
                return;
            }
            throw died(`harness died mid-download: ${errorMessage(err)}`);
        }
        finally {
            context.signal?.removeEventListener?.('abort', onAbort);
            stream?.destroy();
        }
        if (context.signal?.aborted && !emittedAborted) {
            yield { type: 'aborted' };
        }
    }
    async embed(context) {
        const { client } = await this._ensure();
        const response = await abortable(client.embed({ model: context.model, texts: context.texts }), context.signal);
        const rows = unpackVectors(response.dimensions, response.vectors);
        if (rows.length !== context.texts.length) {
            throw new Error(`embed returned ${rows.length} vectors for ${context.texts.length} texts`);
        }
        return rows;
    }
    async transcribe(context) {
        const { client } = await this._ensure();
        const response = await abortable(client.transcribe({ model: context.model, audio: context.audio }), context.signal);
        return response.text;
    }
    async detectLanguage(context) {
        const { client } = await this._ensure();
        const response = await client.detectLanguage({
            text: context.text,
            topK: context.topK
        });
        return response.languages.map(({ code, language, probability }) => probability ? { code, language, probability } : { code, language });
    }
    async speak(context) {
        const { client } = await this._ensure();
        const response = await abortable(client.speak({ model: context.model, text: context.text }), context.signal);
        return { audio: response.audio, sampleRate: response.sampleRate };
    }
    async *speakStream(context) {
        const { client } = await this._ensure();
        const duplex = client.speakStream();
        const pump = (async () => {
            try {
                for await (const fragment of context.text) {
                    const frame = { text: fragment };
                    try {
                        encode('@harness/speak-stream-frame', frame);
                    }
                    catch (err) {
                        throw new Error(`cannot encode speak frame: ${errorMessage(err)}`);
                    }
                    duplex.write(frame);
                }
                duplex.end();
            }
            catch (err) {
                duplex.destroy(err);
            }
        })();
        try {
            for await (const frame of frames(duplex)) {
                yield { audio: frame.audio, sampleRate: frame.sampleRate };
            }
        }
        finally {
            await pump.catch(noop);
        }
    }
    async getEmbeddingDevice() {
        const { client } = await this._ensure();
        return readEmbeddingDeviceResponse(await client.getEmbeddingDevice({}));
    }
    async setEmbeddingDevice(device) {
        const { client } = await this._ensure();
        await client.setEmbeddingDevice({ device });
    }
    async setCredentials(entries) {
        const { client } = await this._ensure();
        await client.setCredentials({ entries });
    }
    async setSkillSettings(entries) {
        const { client } = await this._ensure();
        await client.setSkillSettings({ entries });
    }
    async setModelIdleTimeout(ms) {
        const { client } = await this._ensure();
        await client.setModelIdleTimeout({ ms });
    }
    async setModelMemoryCap(percent) {
        const { client } = await this._ensure();
        await client.setModelMemoryCap({ percent });
    }
    async memoryUsage() {
        const { client } = await this._ensure();
        return await client.memoryUsage({});
    }
    async setDownloadsAllowed({ allowed }) {
        const { client } = await this._ensure();
        await client.setDownloadsAllowed({ allowed });
    }
    async listManagedSkills() {
        const { client } = await this._ensure();
        const response = await client.listManagedSkills({});
        return (response.skills ?? []).map((s) => ({
            name: s.name,
            origin: s.origin === 'overlay' ? 'overlay' : 'base',
            overridesBase: s.overridesBase === true
        }));
    }
    async readSkillFile(name) {
        const { client } = await this._ensure();
        const response = await client.readSkillFile({ name });
        return response?.found
            ? {
                content: response.content ?? '',
                origin: response.origin === 'overlay' ? 'overlay' : 'base'
            }
            : null;
    }
    async writeSkillFile(name, content) {
        const { client } = await this._ensure();
        const response = await client.writeSkillFile({ name, content });
        return { ok: response?.ok === true };
    }
    async copyBaseForEdit(name) {
        const { client } = await this._ensure();
        const response = await client.copySkillForEdit({ name });
        return { copied: response?.copied === true };
    }
    async deleteOverlaySkill(name) {
        const { client } = await this._ensure();
        const response = await client.deleteOverlaySkill({ name });
        return { removed: response?.removed === true };
    }
    async setCustomModels(entries) {
        this._customModels = entries;
        const { client } = await this._ensure();
        await client.setCustomModels({ models: entries });
    }
    async previewModelSource(context) {
        const { client } = await this._ensure();
        const response = await client.previewModelSource({
            src: context.src,
            mmprojSrc: context.mmprojSrc
        });
        return readModelSourcePreview(response);
    }
    async skills(agentId, modelName, options) {
        const { client } = await this._ensure();
        const response = await client.skills({
            agentId: agentId ?? undefined,
            modelName: modelName ?? undefined,
            refresh: options?.refresh === true,
            skipCredentialProbe: options?.skipCredentialProbe === true
        });
        return (response.skills ?? []).map((skill) => {
            const install = readInstall(skill.install);
            const setup = readSetup(skill.setupV2 ?? skill.setup);
            const binaries = skill.requirements?.binaries ?? [];
            const binMinVersions = Object.fromEntries(binaries.flatMap((binary) => {
                const minVersion = binary.minVersion;
                return minVersion
                    ? [
                        [
                            binary.bin,
                            {
                                min: minVersion,
                                command: binary.command || undefined
                            }
                        ]
                    ]
                    : [];
            }));
            return {
                name: skill.name,
                displayName: skill.displayName || undefined,
                description: skill.description,
                tools: skill.tools ?? [],
                credentials: skill.credentials ?? [],
                allowList: skill.allowList ?? [],
                platform: skill.platforms ?? [],
                status: parseSkillState(skill.status),
                requires: skill.requirements
                    ? {
                        bins: binaries.map((binary) => binary.bin),
                        credentials: skill.requirements.credentials?.length
                            ? skill.requirements.credentials
                            : undefined,
                        binMinVersions: Object.keys(binMinVersions).length > 0 ? binMinVersions : undefined
                    }
                    : undefined,
                install,
                setup,
                stub: skill.stub === true ? true : undefined,
                minCapabilityProfile: skill.minCapabilityProfile || undefined,
                emoji: skill.emoji || undefined
            };
        });
    }
    async tools() {
        const { client } = await this._ensure();
        const response = await client.tools({});
        return (response.tools ?? []).map((tool) => ({
            name: tool.name,
            description: tool.description,
            skillGated: tool.skillGated === true,
            scopeRequired: tool.scopeRequired === true,
            toolset: asToolset(tool.toolset),
            rootsRequired: tool.rootsRequired === true,
            writeRootsRequired: tool.writeRootsRequired === true,
            promptChars: tool.promptChars ?? 0
        }));
    }
    async warmModel(context) {
        const { client } = await this._ensure();
        await abortable(client.warmModel({
            model: context.model,
            agent: context.agent ? knobs(context.agent) : undefined
        }), context.signal);
    }
    async loadModel(context) {
        const { client } = await this._ensure();
        const response = await abortable(client.loadModel({
            model: context.model,
            agent: context.agent ? knobs(context.agent) : undefined
        }), context.signal);
        return {
            loaded: response.loaded === true,
            reason: response.reason === 'memory' ? 'memory' : undefined
        };
    }
    async unloadModel(context) {
        const { client } = await this._ensure();
        const response = await client.unloadModel({
            model: context.model
        });
        return { unloaded: response.unloaded === true };
    }
    async knowledgeUpsert(artifact) {
        const { client } = await this._ensure();
        const response = await client.knowledgeUpsert(toKnowledgeUpsertWire(artifact));
        return fromKnowledgeUpsertResultWire(response, artifact.chunks.length);
    }
    async knowledgeRemove(artifactId) {
        const { client } = await this._ensure();
        const response = await client.knowledgeRemove({ artifactId });
        return { removed: response.removed };
    }
    async knowledgeSearch(query) {
        const { client } = await this._ensure();
        const response = await client.knowledgeSearch({
            text: query.text,
            scopes: [...query.scopes],
            k: query.k
        });
        return response.hits.map(fromKnowledgeHitWire);
    }
    async knowledgeStatus() {
        const { client } = await this._ensure();
        const response = await client.knowledgeStatus({});
        return fromKnowledgeStatusWire(response);
    }
    async list(options = {}) {
        const { client } = await this._ensure();
        const response = await client.listModels({
            type: options.type,
            cachedOnly: options.cachedOnly,
            fullRegistry: options.fullRegistry
        });
        return (response.models ?? []).map(({ actualSize, memoryBytes, label, fit, fitBasis, fitEvidence, ...row }) => ({
            ...row,
            actualSize: actualSize || undefined,
            memoryBytes: memoryBytes || undefined,
            label: label || undefined,
            taskType: addonTaskType(row.type),
            fit: (fit || undefined),
            fitBasis: (fitBasis || undefined),
            fitEvidence: (fitEvidence || undefined)
        }));
    }
    async deleteModel(name) {
        const { client } = await this._ensure();
        const response = await client.deleteModel({ name });
        return { name: response.name, removed: response.removed, freedBytes: response.freedBytes };
    }
    async clearKvCache() {
        return this._deleteKvCaches((client) => client.clearKvCache({}));
    }
    async deleteKvCache(kvCacheKey) {
        return this._deleteKvCaches((client) => client.deleteKvCache({ kvCacheKey }));
    }
    async _deleteKvCaches(call) {
        try {
            const { client } = await this._ensure();
            const info = await client.describe({});
            if (info.supportsKvCacheDeletion !== true) {
                return unsupportedKvCacheDeletion();
            }
            const response = await call(client);
            if (response.status === 'success') {
                return { status: 'success' };
            }
            if (response.status === 'failure') {
                return { status: 'failure', error: response.error ?? 'Harness cache deletion failed' };
            }
            return unsupportedKvCacheDeletion(response.error ?? undefined);
        }
        catch (error) {
            return {
                status: 'failure',
                error: errorMessage(error)
            };
        }
    }
    async infraModels(profile) {
        const { client } = await this._ensure();
        const response = await client.infraModels({ profile });
        return response.models ?? [];
    }
    async capability() {
        const { client } = await this._ensure();
        const response = await client.capability({});
        const memoryBudget = response.memoryBudget;
        const capability = {
            capabilityProfile: response.capabilityProfile,
            recommendedModelName: response.recommendedModelName,
            memoryBudget: memoryBudget
                ? {
                    totalBytes: memoryBudget.totalBytes,
                    availableBytes: memoryBudget.availableBytes,
                    source: memoryBudget.source,
                    gpuClass: memoryBudget.gpuClass || undefined
                }
                : undefined,
            mobile: response.mobile === true
        };
        if (response.completionRecovery === true) {
            capability.completionRecovery = true;
        }
        if (response.hostRunLog === true) {
            capability.hostRunLog = true;
        }
        if (response.hostRunLogVersion && response.hostRunLogVersion > 0) {
            capability.hostRunLogVersion = response.hostRunLogVersion;
        }
        return capability;
    }
    close() {
        this._closed = true;
        this._session?.stream.destroy();
    }
    async describe() {
        const { client } = await this._ensure();
        const describe = client.describe;
        if (!describe) {
            return null;
        }
        const info = await describe.call(client, {});
        return {
            toolNames: info?.toolNames ?? [],
            skills: info?.skills ?? [],
            supportsImages: info?.supportsImages ?? false,
            supportsKvCacheDeletion: info?.supportsKvCacheDeletion ?? false
        };
    }
    async fetchDiagnostics() {
        const session = this._session;
        if (!session || session.dead) {
            return null;
        }
        const client = session.client;
        const diagnostics = client.diagnostics;
        if (!diagnostics) {
            return null;
        }
        const snapshot = await diagnostics.call(client, {});
        const device = snapshot?.device;
        return {
            models: (snapshot?.models ?? []).map(loadedModel),
            suspended: snapshot?.suspended ?? false,
            sdkLoaded: snapshot?.sdkLoaded ?? false,
            toolNames: snapshot?.toolNames ?? [],
            skills: snapshot?.skills ?? [],
            device: device || undefined
        };
    }
}
function loadedModel({ model, refs, fit }) {
    if (!fit) {
        return { model, refs };
    }
    const { verdict, reason, plan, deviceBytes, hostBytes } = fit;
    return {
        model,
        refs,
        fit: {
            verdict,
            reason,
            plan: plan ?? undefined,
            deviceBytes: deviceBytes || undefined,
            hostBytes: hostBytes || undefined
        }
    };
}
function parseSkillState(value) {
    return value ? value : SKILL_STATE.failed;
}
function errorDetails(err) {
    return { error: errorMessage(err), code: errorCode(err) };
}
function isToolCallDisplay(value) {
    return isRecord(value) && typeof value.label === 'string';
}
function died(message) {
    return Object.assign(new Error(message), { code: HARNESS_DIED });
}
const noop = () => { };
function abortedRound(signal) {
    const aborted = new Promise((_resolve, reject) => {
        const abort = () => reject(new AbortedError());
        if (signal?.aborted) {
            abort();
        }
        signal?.addEventListener?.('abort', abort, { once: true });
    });
    aborted.catch(noop);
    return aborted;
}
async function servedRound(events, io) {
    let emit = io.emit;
    for await (const event of events) {
        if (io.signal?.aborted)
            break;
        if (event.type === 'content' || event.type === 'thinking') {
            emit({ type: event.type, text: event.text ?? '' });
        }
        else if (event.type === 'model-round-retake') {
            emit = io.retake();
        }
        else if (event.type === 'model-round-result') {
            return roundResultFrom(event);
        }
    }
    throw died('the harness ended a served round without its result');
}
function abortable(promise, signal) {
    if (!signal)
        return promise;
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            promise.then(noop, noop);
            reject(new HarnessError('EMBED_ABORTED'));
            return;
        }
        const onAbort = () => reject(new HarnessError('EMBED_ABORTED'));
        signal.addEventListener?.('abort', onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener?.('abort', onAbort));
    });
}
function knobs(agent) {
    return {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        reasoning: agent.reasoning ?? undefined,
        enabledTools: agent.enabledTools ?? undefined,
        enabledSkills: agent.enabledSkills ?? undefined,
        toolsScope: agent.toolsScope ?? undefined,
        skillsScope: agent.skillsScope ?? undefined,
        ctxSize: agent.ctxSize ?? undefined,
        kvCacheK: agent.kvCacheK ?? undefined,
        kvCacheV: agent.kvCacheV ?? undefined,
        imageModelChoice: agent.imageModelChoice ?? undefined,
        imageSteps: agent.imageSteps ?? undefined,
        imageWidth: agent.imageWidth ?? undefined,
        imageHeight: agent.imageHeight ?? undefined,
        approvalMode: agent.approvalMode ?? undefined,
        disabledToolsets: agent.disabledToolsets ?? undefined,
        policy: agent.policy ?? undefined,
        handoffs: agent.handoffs?.map(({ id, description }) => ({ id, description })),
        plan: agent.plan ?? undefined,
        model: agent.model ?? undefined
    };
}
function explicitEmptyIdentityFields(context) {
    const fields = [];
    if (context.model === '') {
        fields.push('model');
    }
    if (context.cacheKey === '') {
        fields.push('cacheKey');
    }
    if (context.thinkingDefault === '') {
        fields.push('thinkingDefault');
    }
    if (context.agent?.id === '') {
        fields.push('agent.id');
    }
    if (context.agent?.name === '') {
        fields.push('agent.name');
    }
    if (context.agent?.bio === '') {
        fields.push('agent.bio');
    }
    return fields;
}
async function bridgeAttach(event, attach) {
    try {
        if (!attach) {
            return { type: 'attach-result', message: 'the host cannot persist attachments' };
        }
        const bytes = await fs.promises.readFile(event.path ?? '');
        const record = await attach({
            fileName: event.fileName ?? '',
            mimeType: event.mimeType ?? '',
            bytes,
            raw: event.raw === true
        });
        return {
            type: 'attach-result',
            attachment: {
                id: record.id,
                fileName: record.fileName,
                mimeType: record.mimeType,
                byteLength: record.byteLength
            }
        };
    }
    catch (err) {
        return { type: 'attach-result', message: errorMessage(err) };
    }
    finally {
        if (event.path) {
            void fs.promises.unlink(event.path).catch(noop);
        }
    }
}
async function bridgeFetch(event, context, staged) {
    if (!context.fetchAttachment) {
        return { type: 'fetch-result', message: 'the host cannot read attachments' };
    }
    try {
        const metaOnly = event.meta === true;
        const found = await context.fetchAttachment({
            attachmentId: event.attachmentId ?? undefined,
            meta: metaOnly ? true : undefined,
            signal: context.signal
        });
        if (!found) {
            return { type: 'fetch-result' };
        }
        const size = 'bytes' in found && found.bytes !== null ? found.bytes.byteLength : found.byteLength;
        if (metaOnly) {
            return {
                type: 'fetch-result',
                meta: true,
                fileName: found.fileName,
                mimeType: found.mimeType,
                attachmentId: found.id,
                size
            };
        }
        if (!('bytes' in found) || found.bytes === null) {
            return { type: 'fetch-result', message: 'attachment has no bytes' };
        }
        const file = await stageFile('fetch', found.bytes);
        staged.push(file);
        return {
            type: 'fetch-result',
            path: file,
            fileName: found.fileName,
            mimeType: found.mimeType,
            attachmentId: found.id,
            size
        };
    }
    catch (err) {
        return { type: 'fetch-result', message: errorMessage(err) };
    }
}
const DriveRequestSchema = z.discriminatedUnion('op', [
    z.looseObject({ op: z.literal('entry'), driveKey: z.string(), key: z.string() }),
    z.looseObject({ op: z.literal('get'), driveKey: z.string(), key: z.string() }),
    z.looseObject({ op: z.literal('read'), driveKey: z.string(), key: z.string() }),
    z.looseObject({
        op: z.literal('list'),
        driveKey: z.string(),
        folder: z.string(),
        skip: z.array(z.string()),
        recursive: z.boolean(),
        limit: z.number(),
        cursor: z.string().nullable()
    }),
    z.looseObject({
        op: z.literal('write'),
        driveKey: z.string(),
        key: z.string(),
        path: z.string(),
        executable: z.boolean().optional()
    }),
    z.looseObject({
        op: z.literal('search'),
        driveKey: z.string(),
        folder: z.string(),
        queries: z.array(z.string()),
        regex: z.boolean(),
        caseSensitive: z.boolean(),
        includeIgnored: z.boolean(),
        maxMatches: z.number(),
        maxEntries: z.number(),
        maxMs: z.number()
    })
]);
async function bridgeDrive(event, context) {
    if (!context.driveOp) {
        return { type: 'drive-result', message: 'the host cannot proxy drives' };
    }
    try {
        const payload = await context.driveOp(DriveRequestSchema.parse(event.payload));
        return { type: 'drive-result', payload };
    }
    catch (err) {
        return { type: 'drive-result', message: errorMessage(err) };
    }
}
async function sendInput(input, send) {
    const iterator = input[Symbol.asyncIterator]();
    for (;;) {
        const next = await iterator.next();
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (next.done || !send(next.value)) {
            return;
        }
    }
}
function answerQuestion(event, { askUser, reply }) {
    const callId = event.callId;
    if (!askUser) {
        reply({ type: 'question-result', callId, message: 'the host cannot ask questions' });
        return;
    }
    void Promise.resolve()
        .then(() => askUser({
        question: event.question ?? '',
        options: Array.isArray(event.options) ? event.options.map(String) : undefined
    }))
        .then((answer) => reply({ type: 'question-result', callId, answer: answer ?? '' }), (err) => reply({ type: 'question-result', callId, message: errorMessage(err) }))
        .catch((err) => HarnessLog.warn('question reply failed', { callId, message: errorMessage(err) }));
}
async function bridgeRunLog({ event, context, runId, generation }) {
    if (!context.runLog || !generation) {
        return { type: 'run-log-result', message: 'the host does not own this run log' };
    }
    const step = event.payload;
    if (!isEngineStep(step)) {
        return { type: 'run-log-result', message: 'the worker sent an invalid run-log step' };
    }
    try {
        await context.runLog.append(runId ?? '', generation, step);
        return { type: 'run-log-result' };
    }
    catch (err) {
        return { type: 'run-log-result', message: errorMessage(err) };
    }
}
function isEngineStep(value) {
    return (isRecord(value) &&
        typeof value.seq === 'number' &&
        Number.isSafeInteger(value.seq) &&
        value.seq >= 0 &&
        typeof value.expectedLength === 'number' &&
        Number.isSafeInteger(value.expectedLength) &&
        value.expectedLength >= 0 &&
        Array.isArray(value.records));
}
function isDigestKey(value) {
    return value instanceof Uint8Array && value.byteLength === 32;
}
function releaseLateHostLease(pending, runLog, runId) {
    void pending
        .then(async (lease) => {
        if (!lease || typeof lease.generation !== 'string' || !lease.generation) {
            throw new Error('host returned an invalid generation for an aborted run-log begin');
        }
        await runLog.release(runId, lease.generation);
    })
        .catch((err) => HarnessLog.info('aborted run-log begin cleanup failed', {
        runId,
        message: errorMessage(err)
    }));
}
function validateHostRunLogLease(lease, runId) {
    if (typeof lease.generation !== 'string' || !lease.generation || !isDigestKey(lease.digestKey)) {
        throw new Error('host returned an invalid run-log lease');
    }
    if (lease.boot) {
        RunLog.validateEngineBoot(lease.boot);
    }
    const metadata = lease.boot?.metadata;
    if (metadata && metadata.runId !== runId) {
        throw new Error('host returned a run-log boot for a different run');
    }
}
function approvalCall(event) {
    const identity = isRecord(event.payload) ? event.payload : {};
    const approval = {
        name: event.name ?? '',
        arguments: isRecord(event.arguments) ? event.arguments : {},
        resource: event.resource ?? null,
        effect: event.effect === 'read' ? 'read' : 'write',
        intent: event.intent || null,
        display: isToolCallDisplay(event.display) ? event.display : null,
        quote: event.question || null
    };
    if (typeof identity.callId === 'string') {
        approval.callId = identity.callId;
    }
    if (typeof identity.round === 'number') {
        approval.round = identity.round;
    }
    return approval;
}
async function acquireHostRunLogLease(runLog, runId, signal) {
    if (!runId) {
        throw new Error('host-owned run log requires a run id');
    }
    const pending = runLog.begin(runId);
    try {
        return await awaitWithAbort(pending, signal);
    }
    catch (err) {
        if (!signal?.aborted) {
            throw err;
        }
        releaseLateHostLease(pending, runLog, runId);
        return null;
    }
}
function awaitWithAbort(promise, signal) {
    if (!signal)
        return promise;
    if (signal.aborted) {
        return Promise.reject(new Error('operation aborted'));
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => signal.removeEventListener?.('abort', onAbort);
        const onAbort = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(new Error('operation aborted'));
        };
        signal.addEventListener?.('abort', onAbort, { once: true });
        promise.then((value) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(value);
        }, (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        });
    });
}
async function* frames(stream) {
    const queue = pushQueue();
    let error = null;
    stream.on('data', (frame) => queue.push(frame));
    stream.on('end', () => {
        HarnessLog.debug('client stream event', { event: 'end' });
        queue.end();
    });
    stream.on('close', () => {
        HarnessLog.debug('client stream event', { event: 'close' });
        queue.end();
    });
    stream.on('error', (err) => {
        HarnessLog.warn('client stream event', { event: 'error', err: err.message });
        error = err;
        queue.end();
    });
    yield* queue;
    if (error) {
        throw error;
    }
}
async function* downloadFrames(stream) {
    const queue = pushQueue();
    let error = null;
    stream.on('data', (frame) => queue.push(frame));
    stream.on('end', () => queue.end());
    stream.on('close', () => queue.end());
    stream.on('error', (err) => {
        error = err;
        queue.end();
    });
    yield* queue;
    if (error) {
        throw error;
    }
}
