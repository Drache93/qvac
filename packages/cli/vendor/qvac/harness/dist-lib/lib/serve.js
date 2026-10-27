import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import fs from 'fs';
import { HarnessError } from './errors.js';
import { settleOnClose } from './rpc-session.js';
import { pipeline, Readable } from 'streamx';
import { bindApi } from '../spec/bind.js';
import HRPC from '../spec/hrpc/index.js';
import { encode } from '../spec/hrpc/messages.js';
import { checkGoal, checkMaxToolRounds } from './capabilities/tool-turns.js';
import { isCapability } from './capabilities/invoke.js';
import { CUSTOM_TASK_TYPES } from './models/model-catalog.js';
import { unsupportedKvCacheDeletion } from './capabilities/kv-cache.js';
import { RunLog } from './run-log/index.js';
import { errorMessage, isRecord } from './guards.js';
import { HarnessLog } from './log.js';
import { pushQueue } from './queue.js';
import { RoundPort } from './round-port.js';
import { TextCoalescer } from './helpers/text-coalescer.js';
import { prepareOpenclCache } from './models/opencl-cache.js';
import { stageFile, sweepStaging } from './staging.js';
import { sweepSpill } from './spill.js';
import { readSetup, toWireSetup } from './tools/skills/manifest-parse.js';
import { fromKnowledgeUpsertWire, roundFailureWire, roundRequestFrom, packVectors, toDownloadWire, toKnowledgeUpsertResultWire, toWire } from './wire.js';
const MODEL_STATUSES = new Set([
    'loading',
    'downloading',
    'downloaded',
    'ready',
    'error',
    'unloading',
    'unloaded',
    'held'
]);
const DOWNLOAD_PROGRESS_INTERVAL_MS = 500;
const WIRE_HIGH_WATER_MARK = 64;
const TEXT_COALESCE_CAP = 8192;
const TEXT_COALESCE_MS = 60;
function noop() { }
function decodeDigestKey(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) {
        return undefined;
    }
    return b4a.from(value, 'hex');
}
function isEngineBoot(value) {
    if (!isEngineBootEnvelope(value)) {
        return false;
    }
    try {
        RunLog.validateEngineBoot(value);
        return true;
    }
    catch {
        return false;
    }
}
function isEngineBootEnvelope(value) {
    if (!isRecord(value)) {
        return false;
    }
    const counter = (name) => typeof value[name] === 'number' && Number.isSafeInteger(value[name]) && value[name] >= 0;
    const metadata = value.metadata;
    const hasMetadata = metadata === null ||
        (isRecord(metadata) && metadata.version === RunLog.VERSION && metadata.type === 'metadata');
    return (value.protocolVersion === 1 &&
        counter('length') &&
        counter('nextSeq') &&
        counter('deltasSinceCheckpoint') &&
        counter('unredactedLength') &&
        (value.machineVersion === null || typeof value.machineVersion === 'number') &&
        (value.xstateVersion === null || typeof value.xstateVersion === 'string') &&
        hasMetadata &&
        'eventState' in value &&
        (value.snapshotSavedAt === undefined || typeof value.snapshotSavedAt === 'number') &&
        (value.firstSavedAt === undefined || typeof value.firstSavedAt === 'number') &&
        (value.redactedPendingArgs === null || typeof value.redactedPendingArgs === 'boolean') &&
        typeof value.restoredRedacted === 'boolean' &&
        Array.isArray(value.forkBeforeWrite) &&
        Array.isArray(value.receipts) &&
        Array.isArray(value.intentArgs));
}
const EMPTY_IDENTITY_FIELDS = new Set([
    'model',
    'cacheKey',
    'thinkingDefault',
    'agent.id',
    'agent.name',
    'agent.bio'
]);
function optionalNumber(value) {
    return value === undefined || typeof value === 'number';
}
function goalFrom(value) {
    const { objective, rounds, ms, tokens, checks, checksProve } = value;
    if (typeof objective !== 'string' ||
        !optionalNumber(rounds) ||
        !optionalNumber(ms) ||
        !optionalNumber(tokens) ||
        (checks !== undefined &&
            (!Array.isArray(checks) || !checks.every((check) => typeof check === 'string'))) ||
        (checksProve !== undefined && typeof checksProve !== 'boolean')) {
        throw new TypeError('Invalid goal');
    }
    return { objective, rounds, ms, tokens, checks, checksProve };
}
function startPayloadFrom(value) {
    if (!isRecord(value)) {
        return {};
    }
    const payload = {};
    if (value.resume === null || typeof value.resume === 'boolean') {
        payload.resume = value.resume;
    }
    if (value.recoveryEvents === null || typeof value.recoveryEvents === 'boolean') {
        payload.recoveryEvents = value.recoveryEvents;
    }
    if (Object.hasOwn(value, 'explicitEmptyIdentity')) {
        if (!Array.isArray(value.explicitEmptyIdentity) ||
            value.explicitEmptyIdentity.length > EMPTY_IDENTITY_FIELDS.size) {
            throw new TypeError('Invalid explicit-empty identity marker');
        }
        const fields = new Set();
        for (const field of value.explicitEmptyIdentity) {
            if (typeof field !== 'string' || !EMPTY_IDENTITY_FIELDS.has(field)) {
                throw new TypeError('Invalid explicit-empty identity marker');
            }
            fields.add(field);
        }
        if (fields.size) {
            payload.explicitEmptyIdentity = [...fields];
        }
    }
    if (Array.isArray(value.resolutions)) {
        payload.resolutions = value.resolutions.map((resolution) => {
            if (!isRecord(resolution) || typeof resolution.operationId !== 'string') {
                throw new TypeError('Invalid run recovery resolution');
            }
            if (resolution.decision === 'retry') {
                return { operationId: resolution.operationId, decision: 'retry' };
            }
            if (resolution.decision === 'result' && 'result' in resolution) {
                return {
                    operationId: resolution.operationId,
                    decision: 'result',
                    result: resolution.result
                };
            }
            if (resolution.decision === 'skip') {
                return { operationId: resolution.operationId, decision: 'skip' };
            }
            throw new TypeError('Invalid run recovery resolution');
        });
    }
    if (isRecord(value.knowledge)) {
        const { scopes } = value.knowledge;
        if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === 'string')) {
            throw new TypeError('Invalid knowledge grant');
        }
        payload.knowledge = { scopes };
    }
    if (value.planMode === true) {
        payload.planMode = true;
    }
    if (value.deferTools === true) {
        payload.deferTools = true;
    }
    if (typeof value.parentRunId === 'string') {
        payload.parentRunId = value.parentRunId;
    }
    if (isRecord(value.goal)) {
        payload.goal = goalFrom(value.goal);
    }
    if (typeof value.typedText === 'string') {
        payload.typedText = value.typedText;
    }
    if (typeof value.maxToolRounds === 'number') {
        payload.maxToolRounds = checkMaxToolRounds(value.maxToolRounds);
    }
    if (value.replaysContext === true) {
        payload.replaysContext = true;
    }
    if (value.modelRound === true) {
        payload.modelRound = true;
    }
    if (value.roundCut === true) {
        payload.roundCut = true;
    }
    if (value.runLog === null) {
        payload.runLog = null;
    }
    else if (value.runLog) {
        const runLog = isRecord(value.runLog) ? value.runLog : {};
        payload.runLog = {
            boot: runLog.boot,
            digestKey: runLog.digestKey,
            hostAppendTimeoutMs: typeof runLog.hostAppendTimeoutMs === 'number' ? runLog.hostAppendTimeoutMs : undefined
        };
    }
    return payload;
}
function assertEmptyIdentityMarkersMatchFrame(frame, fields) {
    for (const field of fields) {
        let value;
        switch (field) {
            case 'model':
                value = frame.model;
                break;
            case 'cacheKey':
                value = frame.cacheKey;
                break;
            case 'thinkingDefault':
                value = frame.thinkingDefault;
                break;
            case 'agent.id':
                if (frame.agent === null || frame.agent === undefined) {
                    throw new TypeError('Explicit-empty agent identity requires an agent frame');
                }
                value = frame.agent?.id;
                break;
            case 'agent.name':
                if (frame.agent === null || frame.agent === undefined) {
                    throw new TypeError('Explicit-empty agent identity requires an agent frame');
                }
                value = frame.agent?.name;
                break;
            case 'agent.bio':
                if (frame.agent === null || frame.agent === undefined) {
                    throw new TypeError('Explicit-empty agent identity requires an agent frame');
                }
                value = frame.agent?.bio;
                break;
        }
        if (value !== null && value !== undefined && value !== '') {
            throw new TypeError('Conflicting explicit-empty identity marker');
        }
    }
}
function normalizeAgentKnobs(agent) {
    const normalized = { ...agent };
    if (normalized.id === null || normalized.id === undefined) {
        delete normalized.id;
    }
    if (normalized.name === null || normalized.name === undefined) {
        delete normalized.name;
    }
    if (normalized.bio === null || normalized.bio === undefined) {
        delete normalized.bio;
    }
    if (normalized.handoffs === null || normalized.handoffs === undefined) {
        delete normalized.handoffs;
    }
    if (normalized.model === null || normalized.model === undefined) {
        delete normalized.model;
    }
    if (normalized.policy === null || normalized.policy === undefined) {
        delete normalized.policy;
    }
    Reflect.deleteProperty(normalized, 'sandboxMode');
    return normalized;
}
function tick() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
export function serveHarness(stream, harness) {
    sweepStaging();
    sweepSpill();
    prepareOpenclCache();
    const rpc = settleOnClose(new HRPC(stream));
    bindApi(rpc, {
        setCredentials: async ({ entries }) => {
            await harness.setCredentials?.(entries ?? []);
            return { ok: true };
        },
        setSkillSettings: async ({ entries }) => {
            await harness.setSkillSettings?.(entries ?? []);
            return { ok: true };
        },
        setModelIdleTimeout: async ({ ms }) => {
            await harness.setModelIdleTimeout?.(ms);
            return { ok: true };
        },
        setModelMemoryCap: async ({ percent }) => {
            await harness.setModelMemoryCap?.(percent);
            return { ok: true };
        },
        memoryUsage: async () => {
            if (!harness.memoryUsage) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['memoryUsage']);
            }
            return harness.memoryUsage();
        },
        setDownloadsAllowed: async ({ allowed }) => {
            await harness.setDownloadsAllowed?.({ allowed: allowed === true });
            return { ok: true };
        },
        listManagedSkills: async () => ({
            skills: (await harness.listManagedSkills?.()) ?? []
        }),
        readSkillFile: async ({ name }) => {
            const file = await harness.readSkillFile?.(name);
            return file
                ? { found: true, content: file.content, origin: file.origin }
                : { found: false, content: '', origin: '' };
        },
        writeSkillFile: async ({ name, content }) => {
            if (!harness.writeSkillFile) {
                return { ok: false };
            }
            return harness.writeSkillFile(name, content);
        },
        copySkillForEdit: async ({ name }) => ({
            copied: (await harness.copyBaseForEdit?.(name))?.copied ?? false
        }),
        deleteOverlaySkill: async ({ name }) => ({
            removed: (await harness.deleteOverlaySkill?.(name))?.removed ?? false
        }),
        setCustomModels: async ({ models }) => {
            await harness.setCustomModels?.((models ?? []).flatMap((model) => {
                const { name, src, projectionSrc, taskType, expectedSize, label, contextLength } = model;
                const known = CUSTOM_TASK_TYPES.find((task) => task === taskType);
                if (taskType && !known) {
                    return [];
                }
                return [
                    {
                        name,
                        src,
                        projectionSrc: projectionSrc ?? undefined,
                        taskType: known,
                        expectedSize: expectedSize || undefined,
                        label: label || undefined,
                        contextLength: contextLength || undefined
                    }
                ];
            }));
            return { ok: true };
        },
        previewModelSource: async ({ src, mmprojSrc }) => {
            if (!harness.previewModelSource) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['previewModelSource']);
            }
            return harness.previewModelSource({ src: src ?? '', mmprojSrc: mmprojSrc ?? undefined });
        },
        describe: async () => (await harness.describe?.()) ?? {
            toolNames: [],
            skills: [],
            supportsImages: false,
            supportsKvCacheDeletion: false
        },
        diagnostics: async () => harness.diagnostics?.() ?? {
            models: [],
            suspended: false,
            sdkLoaded: false,
            toolNames: [],
            skills: []
        },
        embed: async ({ model, texts }) => {
            if (!harness.embed) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['embed']);
            }
            return packVectors(await harness.embed({ model, texts: texts ?? [] }));
        },
        transcribe: async ({ model, audio }) => {
            if (!harness.transcribe) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['transcribe']);
            }
            return {
                text: await harness.transcribe({ model: model ?? '', audio: audio ?? b4a.alloc(0) })
            };
        },
        detectLanguage: async ({ text, topK }) => {
            if (!harness.detectLanguage) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['detectLanguage']);
            }
            const languages = await harness.detectLanguage({
                text: text ?? '',
                topK: topK ?? undefined
            });
            return { languages };
        },
        speak: async ({ model, text }) => {
            if (!harness.speak) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['speak']);
            }
            return harness.speak({ model: model ?? '', text: text ?? '' });
        },
        speakStream: speakStream(harness),
        getEmbeddingDevice: async () => {
            if (!harness.getEmbeddingDevice) {
                throw unsupportedEmbeddingDeviceControl();
            }
            return { device: await harness.getEmbeddingDevice() };
        },
        setEmbeddingDevice: async ({ device }) => {
            if (!harness.setEmbeddingDevice) {
                throw unsupportedEmbeddingDeviceControl();
            }
            await harness.setEmbeddingDevice(device);
            return { ok: true };
        },
        skills: async (req) => ({
            skills: ((await harness.skills?.(req?.agentId, req?.modelName, {
                refresh: req?.refresh === true,
                skipCredentialProbe: req?.skipCredentialProbe === true
            })) ?? []).map(toWireSkill)
        }),
        tools: async () => ({
            tools: (await harness.tools?.()) ?? []
        }),
        listModels: async (req) => ({
            models: (await harness.list?.({
                type: req?.type || undefined,
                cachedOnly: req?.cachedOnly ?? undefined,
                fullRegistry: req?.fullRegistry ?? undefined
            })) ?? []
        }),
        deleteModel: async (req) => {
            const name = req?.name ?? '';
            return (await harness.deleteModel?.(name)) ?? { name, removed: 0, freedBytes: 0 };
        },
        clearKvCache: async () => (await harness.clearKvCache?.()) ?? unsupportedKvCacheDeletion(),
        deleteKvCache: async ({ kvCacheKey }) => (await harness.deleteKvCache?.(kvCacheKey)) ?? unsupportedKvCacheDeletion(),
        infraModels: async ({ profile }) => ({
            models: (await harness.infraModels?.(profile ?? '')) ?? []
        }),
        capability: async () => {
            if (!harness.capability) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['capability']);
            }
            return harness.capability();
        },
        warmModel: async ({ model, agent }) => {
            if (!harness.warmModel) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['warmModel']);
            }
            await harness.warmModel({ model, agent: agent ?? {} });
            return { ok: true };
        },
        loadModel: async ({ model, agent }) => {
            if (!harness.loadModel) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['loadModel']);
            }
            return harness.loadModel({ model, agent: agent ?? {} });
        },
        unloadModel: async ({ model }) => {
            if (!harness.unloadModel) {
                throw new HarnessError('CAPABILITY_UNSUPPORTED', ['unloadModel']);
            }
            return harness.unloadModel({ model });
        },
        knowledgeUpsert: async (req) => {
            if (!harness.knowledgeUpsert) {
                throw unsupportedKnowledge();
            }
            return toKnowledgeUpsertResultWire(await harness.knowledgeUpsert(fromKnowledgeUpsertWire(req)));
        },
        knowledgeRemove: async ({ artifactId }) => {
            if (!harness.knowledgeRemove) {
                throw unsupportedKnowledge();
            }
            return harness.knowledgeRemove(artifactId);
        },
        knowledgeSearch: async ({ text, scopes, k }) => {
            if (!harness.knowledgeSearch) {
                throw unsupportedKnowledge();
            }
            return { hits: await harness.knowledgeSearch({ text, scopes, k: k || undefined }) };
        },
        knowledgeStatus: async () => {
            if (!harness.knowledgeStatus) {
                throw unsupportedKnowledge();
            }
            return harness.knowledgeStatus();
        },
        modelEvents: () => modelEvents(harness),
        completion: completion(harness)
    });
    rpc.onDownload((out) => {
        const src = downloadStream(harness, out.data);
        pipeline(src, out, noop);
        out.writeStream?.on('close', () => src.destroy());
    });
}
function toWireSkill(skill) {
    const setupV2 = toWireSetup(readSetup(skill.setup));
    const binaries = (skill.requires?.bins ?? []).map((bin) => ({
        bin,
        minVersion: skill.requires?.binMinVersions?.[bin]?.min,
        command: skill.requires?.binMinVersions?.[bin]?.command
    }));
    return {
        name: skill.name,
        displayName: skill.displayName || undefined,
        description: skill.description,
        tools: skill.tools,
        credentials: skill.credentials,
        allowList: skill.allowList,
        platforms: skill.platform,
        status: skill.status,
        requirements: skill.requires
            ? { binaries, credentials: skill.requires.credentials ?? [] }
            : undefined,
        install: skill.install || undefined,
        setup: skill.setup || undefined,
        setupV2,
        stub: skill.stub,
        minCapabilityProfile: skill.minCapabilityProfile || undefined,
        emoji: skill.emoji || undefined
    };
}
function unsupportedKnowledge() {
    return new Error('harness does not support knowledge');
}
function unsupportedEmbeddingDeviceControl() {
    return new HarnessError('CAPABILITY_UNSUPPORTED', ['embedding device control']);
}
function modelEvents(harness) {
    let last = '';
    let pendingProgress = null;
    let lastProgressAt = 0;
    const flushProgress = (at) => {
        if (pendingProgress === null)
            return;
        stream.push(pendingProgress);
        pendingProgress = null;
        lastProgressAt = at;
    };
    const onModel = (state) => {
        if (!MODEL_STATUSES.has(state.status))
            return;
        const percentage = Math.floor(state.percentage ?? 0);
        const downloaded = Math.floor(state.downloaded ?? 0);
        const total = Math.floor(state.total ?? 0);
        const loaded = state.loaded ?? [];
        const catalogChanged = state.catalogChanged === true;
        const key = [
            state.status,
            state.model ?? '',
            percentage,
            downloaded,
            total,
            state.message ?? '',
            catalogChanged,
            ...loaded.map((entry) => `${entry.model}:${entry.refs}`)
        ].join('\0');
        if (key === last && !catalogChanged) {
            return;
        }
        last = key;
        const frame = encodableModelEvent({
            status: state.status,
            model: state.model,
            percentage,
            downloaded,
            total,
            message: state.message,
            catalogChanged,
            loaded,
            addon: state.addon
        });
        const now = Date.now();
        if (frame.status === 'downloading') {
            pendingProgress = frame;
            if (lastProgressAt === 0 || now - lastProgressAt >= DOWNLOAD_PROGRESS_INTERVAL_MS) {
                flushProgress(now);
            }
            return;
        }
        flushProgress(now);
        lastProgressAt = 0;
        stream.push(frame);
    };
    const stream = new Readable({
        open(cb) {
            harness.on?.('model', onModel);
            cb(null);
        },
        destroy(cb) {
            harness.off?.('model', onModel);
            cb(null);
        }
    });
    return stream;
}
function encodableModelEvent(frame) {
    try {
        encode('@harness/model-event', frame);
        return frame;
    }
    catch (err) {
        return { status: 'error', message: `cannot encode model event: ${errorMessage(err)}` };
    }
}
function speakStream(harness) {
    return async function* (duplex) {
        if (!harness.speakStream) {
            throw new HarnessError('CAPABILITY_UNSUPPORTED', ['speakStream']);
        }
        const text = pushQueue();
        const end = () => text.end();
        duplex.on('close', end);
        duplex.on('end', end);
        duplex.readStream?.on('close', end);
        duplex.on('data', (frame) => {
            if (frame.text) {
                text.push(frame.text);
            }
        });
        for await (const chunk of harness.speakStream({ model: '', text })) {
            const frame = { audio: chunk.audio, sampleRate: chunk.sampleRate };
            try {
                encode('@harness/speak-response', frame);
            }
            catch (err) {
                throw new Error(`cannot encode speak frame: ${errorMessage(err)}`);
            }
            yield frame;
        }
    };
}
function runFrame(harness, frame, context) {
    if (frame.type !== 'invoke') {
        return harness.completion(context);
    }
    if (!harness.invoke) {
        throw new HarnessError('CAPABILITY_UNSUPPORTED', ['invoke']);
    }
    const capability = frame.capability ?? '';
    if (!isCapability(capability)) {
        throw new HarnessError('UNKNOWN_CAPABILITY', [capability]);
    }
    return harness.invoke({
        capability,
        args: frame.arguments ?? {},
        enhance: frame.enhance === 'auto' ? 'auto' : 'never',
        agent: frame.agent ?? undefined,
        attach: context.attach,
        fetchAttachment: context.fetchAttachment,
        progress: context.progress,
        signal: context.signal
    });
}
function completion(harness) {
    return async function* (duplex) {
        const events = pushQueue({ highWaterMark: WIRE_HIGH_WATER_MARK });
        const pending = new Map();
        const pendingAttach = new Map();
        const pendingFetch = new Map();
        const pendingQuestion = new Map();
        const pendingDrive = new Map();
        const pendingRunLog = new Map();
        const input = pushQueue();
        const controller = new AbortController();
        const rounds = new RoundPort((event) => events.push(event));
        let calls = 0;
        let started = false;
        let clientGone = false;
        const gone = () => {
            clientGone = true;
            controller.abort('client gone');
            for (const resolve of pending.values()) {
                resolve(false);
            }
            pending.clear();
            for (const { reject, staged } of pendingAttach.values()) {
                void fs.promises.unlink(staged).catch(noop);
                reject(new HarnessError('CLIENT_GONE'));
            }
            pendingAttach.clear();
            for (const { reject } of pendingFetch.values()) {
                reject(new HarnessError('CLIENT_GONE'));
            }
            pendingFetch.clear();
            for (const { resolve } of pendingQuestion.values()) {
                resolve(null);
            }
            pendingQuestion.clear();
            for (const { reject, path } of pendingDrive.values()) {
                if (path) {
                    void fs.promises.unlink(path).catch(noop);
                }
                reject(new HarnessError('CLIENT_GONE'));
            }
            pendingDrive.clear();
            for (const { reject } of pendingRunLog.values()) {
                reject(new HarnessError('CLIENT_GONE'));
            }
            pendingRunLog.clear();
            rounds.close();
            input.end();
            events.end();
        };
        duplex.on('close', gone);
        duplex.on('end', gone);
        duplex.readStream?.on('close', gone);
        duplex.on('data', (frame) => {
            if (rounds.frame(frame)) {
                return;
            }
            if (frame.type === 'model-round-ask' && !started) {
                started = true;
                void serveRound(harness, frame.payload, {
                    signal: controller.signal,
                    events
                });
                return;
            }
            if (frame.type === 'decision') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                pending.get(frame.callId)?.(frame.approved === true);
                pending.delete(frame.callId);
                return;
            }
            if (frame.type === 'attach-result') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                const waiter = pendingAttach.get(frame.callId);
                pendingAttach.delete(frame.callId);
                if (!waiter) {
                    return;
                }
                void fs.promises.unlink(waiter.staged).catch(noop);
                if (frame.attachment) {
                    waiter.resolve(frame.attachment);
                }
                else {
                    waiter.reject(new Error(frame.message || 'the host failed to store the attachment'));
                }
                return;
            }
            if (frame.type === 'fetch-result') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                const waiter = pendingFetch.get(frame.callId);
                pendingFetch.delete(frame.callId);
                if (!waiter) {
                    return;
                }
                if (frame.message) {
                    return waiter.reject(new Error(frame.message));
                }
                const staged = frame.path;
                const { fileName, mimeType, attachmentId, size } = frame;
                if (frame.meta === true) {
                    return waiter.resolve({
                        id: attachmentId ?? '',
                        fileName: fileName ?? '',
                        mimeType: mimeType ?? '',
                        byteLength: typeof size === 'number' ? size : 0
                    });
                }
                if (!staged) {
                    return waiter.resolve(null);
                }
                fs.promises.readFile(staged).then((bytes) => waiter.resolve({
                    id: attachmentId ?? '',
                    fileName: fileName ?? '',
                    mimeType: mimeType ?? '',
                    byteLength: typeof size === 'number' ? size : bytes.byteLength,
                    bytes
                }), (err) => waiter.reject(err));
                return;
            }
            if (frame.type === 'question-result') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                const waiter = pendingQuestion.get(frame.callId);
                pendingQuestion.delete(frame.callId);
                if (!waiter) {
                    return;
                }
                if (frame.message) {
                    HarnessLog.warn('question failed', { callId: frame.callId, message: frame.message });
                }
                waiter.resolve(frame.answer || null);
                return;
            }
            if (frame.type === 'drive-result') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                const waiter = pendingDrive.get(frame.callId);
                pendingDrive.delete(frame.callId);
                if (!waiter) {
                    return;
                }
                if (frame.message) {
                    return waiter.reject(new Error(frame.message));
                }
                waiter.resolve(frame.payload ?? {});
                return;
            }
            if (frame.type === 'pause') {
                controller.abort('paused');
                return;
            }
            if (frame.type === 'steer' || frame.type === 'follow-up') {
                void input.push({
                    mode: frame.type,
                    text: frame.messages?.[0]?.content ?? '',
                    id: frame.callId || undefined
                });
                return;
            }
            if (frame.type === 'run-log-result') {
                if (typeof frame.callId !== 'string') {
                    return;
                }
                const waiter = pendingRunLog.get(frame.callId);
                pendingRunLog.delete(frame.callId);
                if (!waiter) {
                    return;
                }
                if (frame.message) {
                    return waiter.reject(new Error(frame.message));
                }
                waiter.resolve();
                return;
            }
            if (started || (frame.type !== 'start' && frame.type !== 'invoke')) {
                return;
            }
            started = true;
            let startPayload;
            try {
                startPayload = startPayloadFrom(frame.payload);
                if (startPayload.goal) {
                    checkGoal(startPayload.goal, frame.responseFormat);
                }
                assertEmptyIdentityMarkersMatchFrame(frame, startPayload.explicitEmptyIdentity ?? []);
            }
            catch (err) {
                events.push({ type: 'error', message: errorMessage(err) });
                events.push({ type: 'done' });
                events.end();
                return;
            }
            const explicitEmptyIdentity = new Set(startPayload.explicitEmptyIdentity ?? []);
            const runLog = startPayload.runLog;
            const resuming = startPayload.resume === true ||
                Boolean(isEngineBoot(runLog?.boot) && runLog.boot.metadata !== null);
            const requestDigestKey = runLog ? decodeDigestKey(runLog.digestKey) : undefined;
            const agent = normalizeAgentKnobs(frame.agent ?? {});
            if ((frame.agent?.id === null || frame.agent?.id === undefined) &&
                explicitEmptyIdentity.has('agent.id')) {
                agent.id = '';
            }
            if ((frame.agent?.name === null || frame.agent?.name === undefined) &&
                explicitEmptyIdentity.has('agent.name')) {
                agent.name = '';
            }
            if ((frame.agent?.bio === null || frame.agent?.bio === undefined) &&
                explicitEmptyIdentity.has('agent.bio')) {
                agent.bio = '';
            }
            const onStep = runLog
                ? (step) => {
                    if (clientGone) {
                        return Promise.reject(new HarnessError('CLIENT_GONE'));
                    }
                    return new Promise((resolve, reject) => {
                        const callId = String(calls++);
                        pendingRunLog.set(callId, { resolve, reject });
                        events.push({ type: 'run-log-append', callId, payload: step });
                    });
                }
                : undefined;
            const context = {
                runId: frame.runId || undefined,
                resume: resuming,
                recovery: startPayload.resolutions ?? undefined,
                boot: isEngineBoot(runLog?.boot) ? runLog.boot : undefined,
                onStep,
                requestDigestKey,
                hostAppendTimeoutMs: runLog?.hostAppendTimeoutMs,
                model: frame.model ?? '',
                agent,
                cacheKey: frame.cacheKey ?? (explicitEmptyIdentity.has('cacheKey') ? '' : undefined),
                session: frame.session ?? undefined,
                thinkingDefault: frame.thinkingDefault ?? (explicitEmptyIdentity.has('thinkingDefault') ? '' : undefined),
                generationParams: frame.generationParams ?? undefined,
                responseFormat: frame.responseFormat ?? undefined,
                captureInferenceCalls: frame.captureInferenceCalls ?? undefined,
                maxToolRounds: startPayload.maxToolRounds,
                typedText: startPayload.typedText,
                replaysContext: startPayload.replaysContext,
                modelRound: startPayload.modelRound ? rounds.port : undefined,
                roundCut: startPayload.roundCut ? rounds.roundCut : undefined,
                knowledge: startPayload.knowledge,
                planMode: startPayload.planMode,
                deferTools: startPayload.deferTools,
                parentRunId: startPayload.parentRunId,
                goal: startPayload.goal,
                messages: (frame.messages ?? []).map(({ role, content, attachments, toolCalls, toolCallId, name, id, context: added, sentAt }) => ({
                    role,
                    content,
                    attachments: attachments?.length
                        ? attachments.map(({ path: file }) => ({ path: file }))
                        : undefined,
                    toolCalls: toolCalls ?? undefined,
                    toolCallId: toolCallId ?? undefined,
                    name: name ?? undefined,
                    id: id || undefined,
                    context: added ?? undefined,
                    sentAt: sentAt || undefined
                })),
                toolConfigs: frame.toolConfigs ?? undefined,
                grantedDirs: frame.grantedDirs ?? undefined,
                grantedDrives: frame.grantedDrives?.length
                    ? frame.grantedDrives.map((drive) => ({
                        key: drive.key,
                        writable: drive.writable === true,
                        search: drive.search === true
                    }))
                    : undefined,
                driveOp: frame.grantedDrives?.length
                    ? (request) => controller.signal.aborted
                        ? Promise.reject(new HarnessError('CLIENT_GONE'))
                        : new Promise((resolve, reject) => {
                            const callId = String(calls++);
                            pendingDrive.set(callId, {
                                resolve,
                                reject,
                                path: request.op === 'write' ? request.path : undefined
                            });
                            events.push({ type: 'drive-ask', callId, op: request.op, payload: request });
                        })
                    : undefined,
                grantedWriteDirs: frame.grantedWriteDirs ?? undefined,
                signal: controller.signal,
                input,
                approve: (call) => new Promise((resolve) => {
                    const callId = String(calls++);
                    pending.set(callId, resolve);
                    const frame = {
                        type: 'approval-ask',
                        callId,
                        name: call.name,
                        arguments: call.arguments,
                        resource: call.resource ?? undefined,
                        effect: call.effect,
                        intent: call.intent ?? undefined,
                        display: call.display ?? undefined,
                        question: call.quote ?? undefined
                    };
                    if (call.callId !== undefined || call.round !== undefined) {
                        frame.payload = { callId: call.callId, round: call.round };
                    }
                    events.push(frame);
                }),
                attach: async (input) => {
                    const staged = await stageFile('attach', input.bytes);
                    if (controller.signal.aborted) {
                        void fs.promises.unlink(staged).catch(noop);
                        throw new HarnessError('CLIENT_GONE');
                    }
                    return new Promise((resolve, reject) => {
                        const callId = String(calls++);
                        pendingAttach.set(callId, { resolve, reject, staged });
                        events.push({
                            type: 'attach-ask',
                            callId,
                            path: staged,
                            fileName: input.fileName,
                            mimeType: input.mimeType,
                            raw: input.raw ?? false
                        });
                    });
                },
                fetchAttachment: ({ attachmentId, meta } = {}) => controller.signal.aborted
                    ? Promise.reject(new HarnessError('CLIENT_GONE'))
                    : new Promise((resolve, reject) => {
                        const callId = String(calls++);
                        pendingFetch.set(callId, { resolve, reject });
                        events.push({
                            type: 'fetch-ask',
                            callId,
                            attachmentId,
                            meta: meta === true ? true : undefined
                        });
                    }),
                progress: (update) => {
                    events.push(update
                        ? { type: 'progress', percentage: update.percentage }
                        : { type: 'progress', cleared: true });
                },
                askUser: (question) => controller.signal.aborted
                    ? Promise.resolve(null)
                    : new Promise((resolve, reject) => {
                        const callId = String(calls++);
                        pendingQuestion.set(callId, { resolve, reject });
                        events.push({
                            type: 'question-ask',
                            callId,
                            question: question.question,
                            options: question.options
                        });
                    })
            };
            if (resuming) {
                for (const key of [
                    'model',
                    'agent',
                    'messages',
                    'cacheKey',
                    'thinkingDefault',
                    'generationParams',
                    'responseFormat'
                ]) {
                    const value = frame[key];
                    const explicitEmpty = (key === 'model' &&
                        (frame.model === null || frame.model === undefined) &&
                        explicitEmptyIdentity.has('model')) ||
                        (key === 'cacheKey' &&
                            (frame.cacheKey === null || frame.cacheKey === undefined) &&
                            explicitEmptyIdentity.has('cacheKey')) ||
                        (key === 'thinkingDefault' &&
                            (frame.thinkingDefault === null || frame.thinkingDefault === undefined) &&
                            explicitEmptyIdentity.has('thinkingDefault'));
                    if ((value === null || value === undefined || value === '') && !explicitEmpty) {
                        const mutableContext = context;
                        delete mutableContext[key];
                    }
                }
            }
            void (async () => {
                let produced = 0;
                let frames = 0;
                const textIdentity = {};
                const text = new TextCoalescer((type, merged) => {
                    frames++;
                    return events.push({ type, text: merged, ...textIdentity });
                }, { cap: TEXT_COALESCE_CAP, holdMs: TEXT_COALESCE_MS });
                try {
                    if (runLog && !requestDigestKey) {
                        throw new Error('The host did not provide a valid run-log digest key');
                    }
                    if (runLog?.boot &&
                        (!isEngineBoot(runLog.boot) ||
                            (runLog.boot.metadata !== null && runLog.boot.metadata.runId !== frame.runId))) {
                        throw new Error('The host did not provide a valid run-log boot');
                    }
                    if (resuming && !onStep && !(await harness.capability?.())?.completionRecovery) {
                        throw new Error('This peer does not support persistent completion recovery');
                    }
                    for await (const event of runFrame(harness, frame, context)) {
                        produced++;
                        if (!startPayload.recoveryEvents &&
                            ['run-started', 'run-resumed', 'round-reset', 'recovery-required'].includes(event.type)) {
                            continue;
                        }
                        const wire = !startPayload.recoveryEvents && event.type === 'paused'
                            ? { type: 'aborted' }
                            : toWire(event);
                        if (await accumulateTextFrame(wire, textIdentity, text)) {
                            continue;
                        }
                        await text.flush();
                        frames++;
                        await events.push(wire);
                    }
                    await text.flush();
                }
                catch (err) {
                    await text.flush();
                    events.push({ type: 'error', message: errorMessage(err) });
                }
                input.end();
                events.push({ type: 'done' });
                HarnessLog.debug('wire end', { produced, frames });
                events.end();
            })();
        });
        for await (const event of events) {
            try {
                encode('@harness/completion-event', event);
            }
            catch (err) {
                yield { type: 'error', message: `cannot encode ${event.type} event: ${errorMessage(err)}` };
                await tick();
                yield { type: 'done' };
                await tick();
                gone();
                return;
            }
            yield event;
            await tick();
        }
        HarnessLog.info('wire handed off');
    };
}
async function serveRound(harness, request, { signal, events }) {
    let sent = Promise.resolve();
    const queue = (step) => {
        sent = sent.then(step).then(noop);
    };
    const text = new TextCoalescer((type, merged) => events.push({ type, text: merged }), {
        cap: TEXT_COALESCE_CAP,
        holdMs: TEXT_COALESCE_MS
    });
    const emit = (event) => queue(() => text.add(event.type, event.text));
    const retake = () => {
        queue(async () => {
            await text.flush();
            await events.push({ type: 'model-round-retake' });
        });
        return emit;
    };
    let settled;
    try {
        if (!harness.serveModelRound) {
            throw new HarnessError('CAPABILITY_UNSUPPORTED', ['serveModelRound']);
        }
        const result = await harness.serveModelRound(roundRequestFrom(request), {
            signal,
            emit,
            retake
        });
        settled = { type: 'model-round-result', result };
    }
    catch (err) {
        settled = { type: 'model-round-result', ...roundFailureWire(err) };
    }
    queue(() => text.flush());
    await sent;
    events.push(settled);
    events.push({ type: 'done' });
    events.end();
}
function encodableDownloadEvent(wire) {
    try {
        encode('@harness/download-event', wire);
    }
    catch (err) {
        throw new Error(`cannot encode ${wire.type} event: ${errorMessage(err)}`);
    }
    return wire;
}
async function accumulateTextFrame(wire, identity, text) {
    if ((wire.type !== 'content' && wire.type !== 'thinking') || !wire.text) {
        return false;
    }
    if (identity.runId !== wire.runId || identity.round !== wire.round) {
        await text.flush();
    }
    identity.runId = wire.runId;
    identity.round = wire.round;
    await text.add(wire.type, wire.text);
    return true;
}
function downloadStream(harness, req) {
    const controller = new AbortController();
    const stream = new Readable({
        open(cb) {
            void run();
            cb(null);
        },
        destroy(cb) {
            controller.abort('client gone');
            cb(null);
        }
    });
    const run = async () => {
        if (!harness.download) {
            stream.push({
                type: 'error',
                message: 'harness does not support download'
            });
            stream.push(null);
            return;
        }
        let pendingProgress = null;
        let lastProgressAt = 0;
        const flushProgress = (at = Date.now()) => {
            if (pendingProgress === null)
                return;
            stream.push(pendingProgress);
            pendingProgress = null;
            lastProgressAt = at;
        };
        const queueProgress = (wire) => {
            const now = Date.now();
            pendingProgress = wire;
            if (lastProgressAt === 0 || now - lastProgressAt >= DOWNLOAD_PROGRESS_INTERVAL_MS) {
                flushProgress(now);
            }
        };
        try {
            for await (const event of harness.download({
                model: req.model,
                addon: req.addon,
                seed: req.seed,
                signal: controller.signal
            })) {
                const wire = encodableDownloadEvent(toDownloadWire(event));
                if (wire.type === 'progress') {
                    queueProgress(wire);
                    continue;
                }
                flushProgress();
                stream.push(wire);
            }
            flushProgress();
        }
        catch (err) {
            if (!controller.signal.aborted) {
                flushProgress();
                stream.push({ type: 'error', message: errorMessage(err) });
            }
        }
        stream.push(null);
    };
    return stream;
}
