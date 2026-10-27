import defaultFetch from '#fetch';
import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import fs from 'fs';
import crypto from 'hypercore-crypto';
import os from 'os';
import path from 'path';
import { isMobilePlatform, mediaModelNameFor, modelsForAgent, runnableModelName } from '@qvac/harness/lib/models/model-catalog.ts';
import * as z from 'zod';
import { createHostRunLogAdapter, loggedMessages } from './assistant/host-run-log.js';
import { SKILL_STATE } from '@qvac/harness/skill-state';
import { toolsetEnabled } from '@qvac/harness/lib/tools/toolsets.ts';
import { RAG_CITATION_LINE } from '@qvac/harness/lib/prompt.ts';
import { MAX_RAG_SOURCE_URL_CHARS, MAX_RAG_SOURCES_PER_CHUNK, RAG_SOURCE_EXCERPT_CHARS } from '../schema/qvac.js';
import { historyBranches, isPromptChunk } from './core/prompt-history.js';
import { drivenBy, handedOff, offeredTo } from './core/run-driver.js';
import ReadyGuard from 'ready-guard';
import ReadyResource from 'ready-resource';
import { local } from '../spec/index.js';
import { meshScoped } from './mesh-scoped-engine.js';
import { buildTitlePrompt, deriveChatTitle, isDefaultChatTitle, parseTitleResponse } from './chat-title.js';
import { buildSuggestionPrompt, parseSuggestionResponse } from './chat-suggestion.js';
import { matchApprovalRule } from './core/approval-rules.js';
import { isAudioAttachment } from './core/audio-attachment.js';
import { attachTurnDocumentIds, formatRagContext, chooseRagNotice, RAG_KNOWLEDGE_OFF_NOTICE, RAG_TRUNCATED_NOTICE, RAG_UNAVAILABLE_NOTICE, createRagSourceTagFilter, citedByPhraseOverlap, formatFullDocumentContext, isFullTextHit, isTruncatedFullTextHit, sourcesFromHits, WEB_TOOLS, webSourcesFromToolResult, withoutDataChannel } from './core/files/index.js';
import { annotateDocumentAttachments, documentUnreadNotice, documentUnreadReason, pdfPagesCutNotice, pdfPagesSkippedNotice } from './core/document-attachment.js';
import { imageCacheKey, imageCacheName, sweepImageCache } from './core/image/cache-sweep.js';
import { IMAGE_MIMES, normalizeImageForModel } from './core/image/normalize.js';
import { createPdfRasterizer } from './core/pdf/rasterize.js';
import { recordBackends, summarizeRuns } from './diagnostics.js';
import { resolveFsGrants } from './fs-drive-bridge.js';
import { InferenceCallStore } from './inference-calls.js';
import { LOCAL_HOLDER, RunReplayStore, trackSentRun } from './run-replay.js';
import { RunInputQueue, STEERED } from './run-input.js';
import { fsGrantKey, fsWriteGrantKey } from './fs-grant-keys.js';
import { fsGrantsFrom, grantedDirsFrom } from './fs-grants.js';
import { persistentDir } from './persistent-dir.js';
import { ModelCatalogRevisionHub } from './model-catalog-revision.js';
import { agentRekeyFingerprint, agentSwitched, chatKvCacheKey, chatRepairKvCacheKey, disappearedChatIds } from './kv-cache-reclaim.js';
import { buildCompactionPrompt, canCompact, foldReducesPrompt, COMPACTION_KEEP_TURNS, COMPACTION_TURN_PREFIX, isContextOverflowFailure, nearContextLimit, compactionBoundary, lastCompactedThroughId, parseCompactionSummary } from './compaction.js';
import { ModelDownloadReconciler, musicModelChoiceOf } from './model-download.js';
import { AbortedError, raceAbort } from '@qvac/harness/race-abort';
import { RunTranscript } from './run-transcript.js';
import { OwnerRounds, listRoundChunks } from './assistant/model-round.js';
import { RoundHost } from './assistant/round-host.js';
import { searchKnowledge } from './knowledge-search.js';
import { isLifecycleTeardown, knownAbortOutcome, RUN_ABORT_REASONS, RUN_FAILURE_REASONS, runFailureNotice } from './run-notices.js';
import { unref } from './unref.js';
import { encodeAgentSkillReadiness } from './skill-readiness.js';
import { harnessClearKvCache, harnessDeathReason, harnessDeleteModel, harnessDied, harnessListModels, harnessPreviewModelSource, harnessSkillCatalog, harnessSkillManagement, harnessDetectLanguage, harnessSpeak, harnessSpeakStream, harnessTools, harnessTranscribe, heldLoadModel, droppedHeldLoadModel, imageDownloadProgress, isHarnessEvent, modelCatalogChanged, toolReportEntry } from './assistant/harness.js';
import { annotateUnreadableImages, audioTranscriptBlock, backfillDocumentOnlyTurn, backfillImageOnlyTurns, silentAudioNotice, unheardAudioNotice, askedIn, nameSenders, restoreSentContent, hiddenVideoNotice, unreadVideoNotice, unsyncedVideoNotice, VIDEO_NO_AUDIO, VIDEO_SILENT, videoAnnotation, videoTranscriptBlock } from './assistant/message.js';
import { frameTimes, probeVideo, sampleFrames } from './core/video/frames.js';
import { packVideoDigest, parseVideoDigestHeader, unpackVideoDigest, VIDEO_DIGEST_MIME, videoDigestFileName } from './core/video/digest.js';
import { VIDEO_FRAME_EDGE, videoFrameCount } from './assistant/video-budget.js';
import { drainBody, raceInactivity } from './assistant/fetch-body.js';
import { pdfPageBudget } from './assistant/pdf-budget.js';
import { effectiveCtxSize } from './api/effective-ctx-size.js';
import { GENERIC_ACKNOWLEDGEMENTS, HISTORY_TYPES, SKILL_TOOL, TERMINAL_STATES, foldableView, historyFromChunks, listHistoryChunks, replayFromChunks, runPromptView, runView, senderOf, staleToolRunIds, viewOutgrewCache } from './assistant/history.js';
import { errorMessage, isRecord } from './guards.js';
import { CoreError, isCoreError } from './errors.js';
export { harnessClearKvCache, harnessDeleteModel, harnessListModels, harnessPreviewModelSource, harnessSkillCatalog, harnessSkillManagement, harnessDetectLanguage, harnessSpeak, harnessSpeakStream, harnessTools, harnessTranscribe } from './assistant/harness.js';
export {} from './assistant/skill-encode.js';
export { annotateUnreadableImages, unheardAudioNotice, unreadableImagesNotice, DOCUMENT_ONLY_USER_PROMPT, IMAGE_AND_DOCUMENT_USER_PROMPT, IMAGE_ONLY_USER_PROMPT, nameSenders, restoreSentContent } from './assistant/message.js';
export { historyFromChunks, listHistoryChunks, staleToolRunIds } from './assistant/history.js';
const DEFAULT_PROFILE = 'mid';
const QvacState = local.getEnum('@local/qvac-state');
const FINAL_FLUSH_MS = 10_000;
const UPLOAD_FRAME_BYTES = 64 * 1024;
const RUN_IDLE_TIMEOUT_MS = 15 * 60_000;
const MODEL_RELOAD_DELAY_MS = 2_500;
function idleWatch(controller, ms) {
    let last = 0;
    let parked = 0;
    const timer = setInterval(() => {
        if (last && !parked && Date.now() - last >= ms) {
            controller.abort(RUN_ABORT_REASONS.stalled);
        }
    }, Math.min(ms, 30_000));
    unref(timer);
    return {
        touch: () => {
            last = Date.now();
        },
        parks: (fn) => async (...args) => {
            parked++;
            try {
                return await fn(...args);
            }
            finally {
                parked--;
                last = Date.now();
            }
        },
        stop: () => clearInterval(timer)
    };
}
function settledWithin(write, ms) {
    let timer;
    const expired = new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
    });
    const landed = write.then(() => true, () => true);
    return Promise.race([landed, expired]).finally(() => clearTimeout(timer));
}
function isDeniedResult(result) {
    if (!result || typeof result !== 'object')
        return false;
    return 'denied' in result && result.denied === true;
}
const TITLE_PROBE = {
    kind: 'title',
    name: 'chat_title',
    field: 'title',
    runId: 'chat-title'
};
const SUGGESTION_PROBE = {
    kind: 'suggestion',
    name: 'next_message',
    field: 'prompt',
    runId: 'chat-suggestion'
};
const RunOccupancySchema = z.object({
    cacheTokens: z.number().optional().catch(undefined),
    ctxSize: z.number().optional().catch(undefined)
});
export const CAPTURE_INFERENCE_CALLS_KEY = 'inspector.captureInferenceCalls';
export const CAPTURE_ON = 'on';
export const CAPTURE_OFF = 'off';
export const SUGGEST_PROMPTS_KEY = 'assistant.suggestPrompts';
export const SUGGEST_PROMPTS_ON = 'on';
const SUGGESTION_SUPERSEDED = "superseded by the chat's next run";
function pdfCut(doc, from) {
    const pageCount = doc.pageCount();
    for (let page = from; page < pageCount; page++) {
        try {
            const flags = doc.pageFlags(page);
            if (flags.hasImage || !flags.hasText) {
                return { lastPage: page, pageCount };
            }
        }
        catch {
        }
    }
    return undefined;
}
function attachPages(turn, files) {
    if (!files.length)
        return;
    turn.attachments = [...(turn.attachments ?? []), ...files.map((file) => ({ path: file }))];
}
function noBytes() {
    return Promise.resolve(null);
}
function videoFrameCacheName(video, count, frame) {
    return imageCacheName({ blobId: video.blobId, fileName: `frames.${count}.f${frame}.jpg` });
}
function videoHeaderCacheName(digestBlobId) {
    return imageCacheName({ blobId: digestBlobId, fileName: 'frames.json' });
}
function videoAudioBlock(fileName, { audio, transcript }) {
    if (audio === 'none') {
        return VIDEO_NO_AUDIO;
    }
    if (audio === 'silent') {
        return VIDEO_SILENT;
    }
    if (audio === 'speech' && transcript) {
        return videoTranscriptBlock(transcript);
    }
    return unheardAudioNotice(`The audio of the attached video "${fileName}"`, 'transcription failed');
}
function pdfPageCacheName(pdf, page) {
    return imageCacheName({ blobId: pdf.blobId, fileName: `${pdf.fileName}.p${page}.jpg` });
}
async function cacheOrTouch(file, produce) {
    const cached = await fs.promises.stat(file).catch(noop);
    if (cached?.size) {
        const now = new Date();
        await fs.promises.utimes(file, now, now).catch(noop);
        return true;
    }
    const bytes = await produce();
    if (!bytes) {
        return false;
    }
    const staging = `${file}.partial-${b4a.toHex(crypto.randomBytes(4))}`;
    await fs.promises.writeFile(staging, bytes, { mode: 0o600 });
    await fs.promises.rename(staging, file);
    return true;
}
const BLOB_READ_TIMEOUT_MS = 15_000;
const SUSPENDED = RUN_ABORT_REASONS.suspended;
const OWNERSHIP_LOST = RUN_ABORT_REASONS.ownershipLost;
const RUN_SETTLED = RUN_ABORT_REASONS.runSettled;
const RUNNER_DIED = RUN_ABORT_REASONS.runnerDied;
const RUNNER_CLOSED = RUN_ABORT_REASONS.runnerClosed;
const MODEL_UNLOADED = RUN_ABORT_REASONS.modelUnloaded;
const RUN_PAUSED = 'paused on a saved checkpoint; it resumes from there';
function recoveryReason(event) {
    const operation = isRecord(event.operation) ? event.operation.name : undefined;
    const call = typeof operation === 'string' ? ` of ${operation}` : '';
    return `the outcome${call} is unknown, so it is not run again: decide before this run continues`;
}
function keepsRunLog(capability) {
    return capability?.hostRunLog === true && capability.hostRunLogVersion === 1;
}
function isSetUpHere(status) {
    return status === SKILL_STATE.ready || status === SKILL_STATE.incompatibleModel;
}
function sameNameList(left, right) {
    return left.length === right.length && left.every((name, index) => name === right[index]);
}
function sameLoadSettings(a, b) {
    return ((a.ctxSize ?? 0) === (b.ctxSize ?? 0) &&
        (a.kvCacheK ?? '') === (b.kvCacheK ?? '') &&
        (a.kvCacheV ?? '') === (b.kvCacheV ?? ''));
}
function withConfigDefaults(agent, config) {
    if (agent.ctxSize || !config?.ctxSize)
        return agent;
    return { ...agent, ctxSize: config.ctxSize };
}
function thinkingDefault(config) {
    if (!config)
        return undefined;
    return config.thinkingEnabled ? 'enabled' : 'disabled';
}
const RAG_SOURCE_BOUNDS = {
    maxSources: MAX_RAG_SOURCES_PER_CHUNK,
    excerptChars: RAG_SOURCE_EXCERPT_CHARS
};
const WEB_RAG_SOURCE_BOUNDS = { ...RAG_SOURCE_BOUNDS, maxUrlChars: MAX_RAG_SOURCE_URL_CHARS };
export class QvacAssistant extends ReadyResource {
    _engine;
    _harness;
    _log;
    _imageCacheDir;
    _imageCacheMaxBytes;
    _imageCacheMaxAgeMs;
    _downloadRetryMs;
    _platform;
    _mobileClass;
    _preloadCurrentAgentModel;
    _drives;
    _blobReadTimeoutMs;
    _runIdleTimeoutMs;
    _modelReloadDelayMs;
    _reloads = new Map();
    _pdfRasterizer;
    _warmAbort = new AbortController();
    _unloading = new Map();
    _warmedModel = false;
    _warmedModelName = null;
    _modelStatusLogged = new Map();
    _deviceId;
    _info;
    _lastCapabilities = new Map();
    _ownWorkspace = null;
    _listed = [];
    _accountHosted = [];
    _readySkills;
    _recordingReadiness = false;
    _readinessDirty = false;
    _reconciling;
    _onlineBoot = new ReadyGuard();
    _accountSeen = Promise.withResolvers();
    _capability;
    _downloads;
    _state;
    _harnessDiagnostics;
    _harnessDeath;
    _refreshingDiagnostics;
    _backendUse = new Map();
    _meshList;
    _accountFrames;
    _accountMeshId;
    _advertisedOn;
    _meshListWatch;
    _accountWatch;
    _meshConsumers;
    _servedChats = new Map();
    _runs;
    _steered = new Map();
    _idleWaiters = new Set();
    _seen;
    _parked;
    _handedOff = new Map();
    _backgroundReplays;
    _inferenceCalls;
    _runReplay;
    _roundHost;
    _lifecycle;
    _suggesting = new Map();
    _audioTranscripts;
    _videoProbes;
    _pdfPages;
    _mediaRefs;
    _chats;
    _runImageCacheNames;
    _reconciledCompactions;
    _modelCatalog = new ModelCatalogRevisionHub();
    _onHarnessStatus;
    _onModelCatalogEvent;
    constructor(engine, harness, { logger = null, imageCacheDir, inferenceCallsDir, runReplayDir, imageCacheMaxBytes, imageCacheMaxAgeMs, downloadRetryMs, platform = os.platform(), preloadCurrentAgentModel = true, drives, blobReadTimeoutMs = BLOB_READ_TIMEOUT_MS, runIdleTimeoutMs = RUN_IDLE_TIMEOUT_MS, modelReloadDelayMs = MODEL_RELOAD_DELAY_MS, pdfRasterizer: pdfRasterizerOption } = {}) {
        super();
        this._engine = engine;
        this._harness = harness;
        this._drives = drives;
        this._log = logger;
        this._imageCacheDir = imageCacheDir ?? persistentDir('image-cache');
        this._imageCacheMaxBytes = imageCacheMaxBytes;
        this._imageCacheMaxAgeMs = imageCacheMaxAgeMs;
        this._downloadRetryMs = downloadRetryMs;
        this._platform = platform;
        this._mobileClass = isMobilePlatform(platform);
        this._preloadCurrentAgentModel = preloadCurrentAgentModel;
        this._blobReadTimeoutMs = blobReadTimeoutMs;
        this._runIdleTimeoutMs = runIdleTimeoutMs;
        this._modelReloadDelayMs = modelReloadDelayMs;
        this._pdfRasterizer = pdfRasterizerOption ?? createPdfRasterizer(logger);
        const serve = harness.serveModelRound?.bind(harness);
        this._roundHost = serve
            ? new RoundHost({
                engine,
                serve,
                deviceId: () => this._requireDeviceId(),
                media: {
                    resolve: (sources, served) => this._servedMedia(sources, served),
                    release: (id) => this._runImageCacheNames.delete(`round:${id}`)
                },
                log: logger
            })
            : null;
        this._deviceId = null;
        this._info = { toolNames: [], skills: [], supportsImages: false };
        this._readySkills = null;
        this._reconciling = false;
        this._capability = null;
        this._downloads = null;
        this._state = QvacState.RESUME;
        this._harnessDiagnostics = null;
        this._harnessDeath = null;
        this._refreshingDiagnostics = false;
        this._meshList = null;
        this._accountFrames = null;
        this._accountMeshId = null;
        this._advertisedOn = null;
        this._meshListWatch = this._supervisedWatch('mesh-list', () => this._watchMeshList());
        this._accountWatch = this._supervisedWatch('account', () => this._watchAccount());
        this._meshConsumers = new Map();
        this._runs = new Map();
        this._seen = new Map();
        this._parked = new Map();
        this._backgroundReplays = new Set();
        this._inferenceCalls = new InferenceCallStore(inferenceCallsDir ?? persistentDir('inspector'));
        this._runReplay = new RunReplayStore(runReplayDir ?? persistentDir('run-replay'));
        this._lifecycle = new AbortController();
        this._audioTranscripts = new Map();
        this._videoProbes = new Map();
        this._pdfPages = new Map();
        this._mediaRefs = new Map();
        this._chats = new Map();
        this._runImageCacheNames = new Map();
        this._reconciledCompactions = new Map();
        this._onHarnessStatus = (status) => {
            this._log?.warn('assistant', 'harness status', status);
            if (harnessDied(status)) {
                this._harnessDeath = harnessDeathReason(status);
                for (const run of this._runs.values()) {
                    run.controller.abort(RUNNER_DIED);
                }
            }
            else {
                this._harnessDeath = null;
            }
            this.emit('harness-status', status);
        };
        this._onModelCatalogEvent = (state) => {
            this._logModelStatus(state);
            if (modelCatalogChanged(state)) {
                this._modelCatalog.notify();
            }
            const progress = imageDownloadProgress(state);
            if (progress) {
                this._downloads?.observeImageProgress(progress);
            }
            const held = heldLoadModel(state);
            if (held) {
                this._downloads?.observeHeldLoad(held);
            }
            const dropped = droppedHeldLoadModel(state);
            if (dropped) {
                this._downloads?.observeDroppedHeldLoad(dropped);
            }
        };
    }
    _requireDeviceId() {
        if (!this._deviceId)
            throw new Error('assistant device id read before open');
        return this._deviceId;
    }
    async _open() {
        this._log?.info('assistant', 'host platform resolved', {
            platform: this._platform,
            mobileClass: this._mobileClass
        });
        const info = await this._engine.deviceInfo({});
        this._deviceId = info.id;
        this._harness.on?.('status', this._onHarnessStatus);
        this._harness.on?.('model', this._onModelCatalogEvent);
        this._info = await this._describeHarness();
        await this._clearPreReplayCaches();
        await this._clearPersistedPauses();
        this._downloads = new ModelDownloadReconciler({
            engine: this._engine,
            harness: this._harness,
            deviceId: this._deviceId,
            meshId: () => this._accountMeshId,
            onCacheChanged: () => {
                this._modelCatalog.notify();
                void this._reportCapabilities();
                this._triggerModelWarm();
            },
            retryMs: this._downloadRetryMs,
            logger: this._log,
            mobileClass: this._mobileClass
        });
        this._downloads.start();
        this._meshListWatch.start();
        this._accountWatch.start();
        void this._bootOnline();
        this._triggerModelWarm();
        void this.onlineReady().then(() => this._triggerModelWarm(), noop);
    }
    _triggerModelWarm() {
        if (!this._preloadCurrentAgentModel)
            return;
        void this._warmCurrentAgentModel().catch((err) => this._log?.warn('assistant', 'current agent model warm failed', err));
    }
    async _warmCurrentAgentModel() {
        if (this._warmedModel || !this._deviceId)
            return;
        const deviceId = this._deviceId;
        const config = await this._engine.getConfig({}).catch(noop);
        const agent = await this._currentAgent(config?.activeAgentId ?? null, deviceId);
        if (!agent?.modelName ||
            !agent.providerDeviceId ||
            !b4a.equals(agent.providerDeviceId, deviceId) ||
            this.suspended) {
            return;
        }
        const model = runnableModelName(agent.modelName, await this._runnableHost());
        if (!(await this._isCached(model))) {
            this._log?.info('models', 'model warm skipped', { model, reason: 'not cached' });
            return;
        }
        if (this._warmedModel) {
            return;
        }
        this._warmedModel = true;
        this._warmedModelName = model;
        this._log?.info('models', 'model warm started', { model, agentModel: agent.modelName });
        const started = Date.now();
        await this._harness.warmModel?.({
            model,
            agent: withConfigDefaults(agent, config),
            signal: this._warmAbort.signal
        });
        this._log?.info('models', 'model warm done', { model, ms: Date.now() - started });
    }
    async _currentAgent(activeAgentId, deviceId) {
        const meshId = this._accountMeshId;
        if (!meshId) {
            return null;
        }
        if (activeAgentId) {
            const active = await this._engine.getAgent({ agentId: activeAgentId, meshId }).catch(noop);
            if (active) {
                return active;
            }
        }
        try {
            const own = await this._engine.getDefaultAgent({ meshId, providerDeviceId: deviceId });
            if (own.agent) {
                return own.agent;
            }
            const any = await this._engine.getDefaultAgent({ meshId });
            return any.agent ?? null;
        }
        catch (err) {
            this._log?.warn('models', 'reading the default agent for the warm failed', err);
            return null;
        }
    }
    async _bootOnline() {
        void this._onlineBoot.ready().catch(noop);
        try {
            await this._accountSeen.promise;
            await Promise.allSettled([
                this._sweepImageCache(),
                this._sweepInferenceCalls(),
                this._reportCapabilities(),
                this._reconcileDeviceProfile()
            ]);
        }
        finally {
            this._onlineBoot.exit();
        }
    }
    async onlineReady() {
        if (!this.opened)
            await this.ready();
        await this._onlineBoot.ready();
    }
    async _clearPersistedPauses() {
        try {
            const config = await this._engine.getConfig({});
            for (const name of config.pausedModels ?? []) {
                await this._engine.setModelPaused({ name, paused: false });
            }
        }
        catch (err) {
            this._log?.warn('assistant', 'clearing persisted model pauses failed', err);
        }
    }
    async ensureMediaModelUnpaused(category, model) {
        try {
            const name = model || mediaModelNameFor(category, await this._persistedProfile());
            const config = await this._engine.getConfig({});
            if (!(config.pausedModels ?? []).includes(name)) {
                return true;
            }
            await this._engine.setModelPaused({ name, paused: false });
            return true;
        }
        catch (err) {
            this._log?.warn('assistant', 'ensuring media model unpaused failed', err);
            return false;
        }
    }
    async _persistedProfile() {
        await this._accountSeen.promise;
        const deviceId = this._deviceId;
        const meshId = this._accountMeshId;
        if (!deviceId || !meshId) {
            return DEFAULT_PROFILE;
        }
        try {
            const self = await this._engine.getDevice({ meshId, deviceId });
            return self.capabilityProfile ?? DEFAULT_PROFILE;
        }
        catch (err) {
            this._log?.warn('assistant', 'reading this device profile failed', err);
            return DEFAULT_PROFILE;
        }
    }
    async _sweepImageCache(gone = new Set()) {
        try {
            const keep = await this._referencedImageNames(gone);
            await sweepImageCache(this._imageCacheDir, {
                maxBytes: this._imageCacheMaxBytes,
                maxAgeMs: this._imageCacheMaxAgeMs,
                inUse: (name) => this._imageCacheInUse(name),
                keep: keep ?? undefined
            });
        }
        catch (err) {
            this._log?.warn('assistant', 'image cache sweep failed', err);
        }
    }
    async _sweepInferenceCalls() {
        try {
            const { removed } = await this._inferenceCalls.sweep();
            if (removed > 0) {
                this._log?.info('assistant', 'inspector records swept', { removed });
            }
        }
        catch (err) {
            this._log?.warn('assistant', 'inspector record sweep failed', err);
        }
    }
    _imageCacheInUse(name) {
        for (const names of this._runImageCacheNames.values()) {
            if (names.has(name))
                return true;
        }
        return false;
    }
    async _referencedImageNames(gone) {
        try {
            const { files } = await this._engine.listLocalFiles({});
            if (!files?.length) {
                return null;
            }
            const live = files.filter((file) => !file.chatId || !gone.has(file.chatId));
            return new Set(live.map((file) => imageCacheKey(file.blobId)));
        }
        catch (err) {
            this._log?.warn('assistant', 'reading the local file index failed', err);
            return null;
        }
    }
    async _describeHarness() {
        const described = await this._harness.describe?.();
        return (described ?? {
            toolNames: this._harness.toolNames ?? [],
            skills: this._harness.skillNames ?? [],
            supportsImages: this._harness.supportsImages ?? false
        });
    }
    async _capturingInferenceCalls() {
        try {
            const { value } = await this._engine.configGet({ key: CAPTURE_INFERENCE_CALLS_KEY });
            return value === CAPTURE_ON;
        }
        catch (err) {
            this._log?.warn('assistant', 'inspector capture flag unreadable', { err });
            return false;
        }
    }
    inferenceCalls(chatId) {
        return this._inferenceCalls.list(chatId);
    }
    forgetInferenceCalls(chatId) {
        return this._inferenceCalls.forget(chatId);
    }
    diagnosticsSlice() {
        const harness = this._harness.diagnostics?.() ?? this._harnessDiagnostics;
        void this._refreshHarnessDiagnostics();
        const runs = [...this._runs.entries()].map(([runId, run]) => ({
            runId,
            chatId: run.chatId,
            model: run.model
        }));
        return {
            harness,
            assistant: summarizeRuns(runs, this.suspended),
            platform: this._platform,
            mobileClass: this._mobileClass,
            memoryBudget: this._capability?.memoryBudget ?? null,
            backendUse: Object.fromEntries([...this._backendUse].map(([tool, uses]) => [tool, [...uses]]))
        };
    }
    async _refreshHarnessDiagnostics() {
        if (this._refreshingDiagnostics || !this._harness.fetchDiagnostics)
            return;
        this._refreshingDiagnostics = true;
        try {
            this._harnessDiagnostics = await this._harness.fetchDiagnostics();
        }
        catch {
        }
        finally {
            this._refreshingDiagnostics = false;
        }
    }
    async _reportCapabilities() {
        let models;
        try {
            models = (await this._harness.list?.()) ?? [];
        }
        catch (err) {
            this._log?.warn('assistant', '_reportCapabilities: harness.list failed — keeping last catalog', err);
            return;
        }
        const installedModelNames = models.map((model) => model.name);
        const cachedModelNames = models.filter((model) => model.isCached).map((model) => model.name);
        let toolCatalog = null;
        if (this._harness.tools) {
            try {
                toolCatalog = (await this._harness.tools()).map(toolReportEntry);
            }
            catch (err) {
                this._log?.warn('assistant', '_reportCapabilities: harness.tools failed', err);
            }
        }
        const key = JSON.stringify([
            this._info.toolNames,
            this._info.skills,
            installedModelNames,
            cachedModelNames,
            this._readySkills,
            toolCatalog
        ]);
        const meshId = this._accountMeshId;
        if (!meshId) {
            return;
        }
        await this._reportInto(meshId, key, {
            installedToolNames: this._info.toolNames,
            installedSkillNames: this._info.skills,
            installedModelNames,
            cachedModelNames,
            readySkillNames: this._readySkills ?? undefined,
            toolCatalog: toolCatalog ?? undefined
        });
    }
    async _reportInto(meshId, key, report) {
        if (this._lastCapabilities.get(meshId) === key)
            return;
        try {
            await this._engine.saveDeviceCapabilities({ meshId, ...report });
            this._lastCapabilities.set(meshId, key);
        }
        catch (err) {
            if (isCoreError(err, 'MESH_NOT_FOUND')) {
                return;
            }
            this._log?.error('assistant', 'saveDeviceCapabilities failed', err);
        }
    }
    _followHosted(meshId, agents) {
        const deviceId = this._deviceId;
        if (!deviceId || meshId !== this._accountMeshId) {
            return;
        }
        const hosted = agents
            .filter((agent) => !!agent.providerDeviceId && b4a.equals(agent.providerDeviceId, deviceId))
            .map((agent) => agent.id)
            .sort();
        if (sameNameList(this._accountHosted, hosted)) {
            return;
        }
        this._accountHosted = hosted;
        void this._reportHosted().catch(noop);
    }
    async _reportHosted() {
        if (this._readySkills) {
            await this._recordSkillReadiness();
        }
        await this._reportCapabilities();
    }
    async _ensureCapability() {
        if (this._capability)
            return this._capability;
        let probed;
        try {
            probed = await this._harness.capability?.();
        }
        catch (err) {
            this._log?.warn('assistant', '_reconcileDeviceProfile: harness.capability failed', err);
            return null;
        }
        if (!probed?.recommendedModelName) {
            return null;
        }
        this._capability = probed;
        return probed;
    }
    async _reconcileDeviceProfile() {
        const deviceId = this._deviceId;
        const meshId = this._accountMeshId;
        if (!deviceId || !meshId || this._reconciling) {
            return;
        }
        this._reconciling = true;
        try {
            const capability = await this._ensureCapability();
            if (!capability) {
                return;
            }
            const self = await this._engine.getDevice({ meshId, deviceId }).catch(noop);
            if (!self) {
                return;
            }
            const profileUpdated = !(self.capabilityProfile === capability.capabilityProfile &&
                self.recommendedModelName === capability.recommendedModelName &&
                self.platform === this._platform);
            const profile = {
                publicKey: b4a.toHex(deviceId),
                name: self.name,
                platform: this._platform,
                mobileClass: this._mobileClass,
                capabilityProfile: capability.capabilityProfile,
                recommendedModelName: capability.recommendedModelName,
                memoryBudget: capability.memoryBudget
            };
            if (profileUpdated) {
                try {
                    await this._engine.saveDeviceProfile({
                        meshId,
                        capabilityProfile: capability.capabilityProfile,
                        recommendedModelName: capability.recommendedModelName,
                        platform: this._platform
                    });
                }
                catch (err) {
                    this._log?.error('assistant', 'saveDeviceProfile failed', profile, err);
                    return;
                }
            }
            this._log?.info('assistant', 'device profile resolved', { ...profile, profileUpdated });
        }
        finally {
            this._reconciling = false;
        }
    }
    async _close() {
        this._stopMeshIntake();
        this._harness.off?.('status', this._onHarnessStatus);
        this._harness.off?.('model', this._onModelCatalogEvent);
        this._warmAbort.abort(RUNNER_CLOSED);
        this._cancelModelReloads();
        this._onlineBoot.destroy(new CoreError('ASSISTANT_CLOSING'));
        for (const run of this._runs.values()) {
            run.controller.abort(RUNNER_CLOSED);
        }
        await this._downloads?.close();
        this._modelCatalog.close();
        this._meshList?.destroy();
        this._accountFrames?.destroy();
        this._lifecycle.abort(RUNNER_CLOSED);
        for (const pending of this._suggesting.values()) {
            pending.abort(RUNNER_CLOSED);
        }
        await Promise.allSettled([...this._runs.values()].map((run) => run.done));
    }
    get mobileClass() {
        return this._mobileClass;
    }
    get suspended() {
        return this._state === QvacState.SUSPEND;
    }
    get _backgrounded() {
        return this._state === QvacState.PRESUSPEND || this._state === QvacState.SUSPEND;
    }
    async presuspend() {
        if (this.closing)
            return;
        this._state = QvacState.PRESUSPEND;
        this._log?.info('assistant', 'presuspend');
    }
    async suspend() {
        this._log?.info('assistant', 'suspend called');
        if (this._state === QvacState.SUSPEND) {
            return;
        }
        if (this.closing) {
            return;
        }
        this._state = QvacState.SUSPEND;
        this._log?.info('assistant', 'suspending', { runs: this._runs.size });
        this._parked.clear();
        this._stopMeshIntake();
        this._cancelModelReloads();
        await this._downloads?.suspend();
        this._meshList?.destroy();
        this._accountFrames?.destroy();
        for (const run of this._runs.values()) {
            run.controller.abort(SUSPENDED);
        }
        this._warmedModel = false;
        this._warmedModelName = null;
        this._modelCatalog.notify();
    }
    async wakeup() {
        if (this.closing)
            return;
        this._state = QvacState.WAKEUP;
        this._log?.info('assistant', 'wakeup');
        await this.resume();
        this._triggerModelWarm();
    }
    async resume() {
        this._log?.info('assistant', 'resume called');
        if (this._state === QvacState.RESUME) {
            return;
        }
        if (this.closing) {
            return;
        }
        if (this._state === QvacState.PRESUSPEND) {
            this._state = QvacState.RESUME;
            this._parked.forEach((replay) => replay());
            this._parked.clear();
            this._takeBackHandedOff();
            return;
        }
        this._state = QvacState.RESUME;
        this._log?.info('assistant', 'resuming');
        await Promise.allSettled([...this._runs.values()].map((run) => run.done));
        this._downloads?.resume();
        if (!this.opened) {
            return;
        }
        this._meshListWatch.start();
        this._accountWatch.start();
    }
    async listModels(options) {
        return (await this._harness.list?.(options)) ?? [];
    }
    async deleteModel(name) {
        const removeFiles = async () => (await this._harness.deleteModel?.(name)) ?? { name, removed: 0, freedBytes: 0 };
        let summary;
        if (this._downloads) {
            summary = await this._downloads.release(name, removeFiles);
        }
        else {
            summary = await removeFiles();
            await this._engine.setModelReleased({ name, released: true });
        }
        this._modelCatalog.notify();
        this._reportCapabilities().catch(noop);
        return summary;
    }
    modelCatalogWatch() {
        return this._modelCatalog.watch();
    }
    async loadModel(name) {
        if (!this._harness.loadModel) {
            throw new CoreError('MODEL_RUNTIME_UNSUPPORTED', ['preload']);
        }
        if (!(await this._isCached(name))) {
            throw new CoreError('MODEL_NOT_DOWNLOADED', [name]);
        }
        const config = await this._engine.getConfig({}).catch(noop);
        const agent = await this._agentRunning(name, config?.activeAgentId ?? null);
        const knobs = agent
            ? withConfigDefaults(agent, config)
            : { ctxSize: config?.ctxSize || undefined };
        const { loaded, reason } = await this._harness.loadModel({ model: name, agent: knobs });
        this._log?.info('models', 'model load requested', { model: name, loaded, reason });
        return { loaded, reason };
    }
    async _isCached(model) {
        const rows = await this._harness.list?.({ cachedOnly: true }).catch(noop);
        return rows?.some((row) => row.name === model && row.isCached) === true;
    }
    _scheduleModelReload(agent) {
        const deviceId = this._deviceId;
        if (!this._harness.loadModel ||
            !deviceId ||
            !agent.modelName ||
            !agent.providerDeviceId ||
            !b4a.equals(agent.providerDeviceId, deviceId)) {
            return;
        }
        const name = agent.modelName;
        clearTimeout(this._reloads.get(name));
        const timer = setTimeout(() => {
            this._reloads.delete(name);
            this._reloadLoadedModel(agent).catch((err) => this._log?.warn('models', 'model reload failed', { model: name, err }));
        }, this._modelReloadDelayMs);
        unref(timer);
        this._reloads.set(name, timer);
    }
    async _reloadLoadedModel(agent) {
        if (this.closing || this.suspended || !this._harness.loadModel)
            return;
        const model = runnableModelName(agent.modelName, await this._runnableHost());
        const rows = await this._harness.list?.({ cachedOnly: true }).catch(noop);
        const busy = [...this._runs.values()].some((run) => run.executing && run.model === model);
        if (busy || !rows?.some((row) => row.name === model && row.isLoaded)) {
            return;
        }
        const config = await this._engine.getConfig({}).catch(noop);
        const knobs = withConfigDefaults(agent, config);
        const { loaded, reason } = await this._harness.loadModel({ model, agent: knobs });
        this._log?.info('models', 'model reload requested', { model, loaded, reason });
    }
    _cancelModelReloads() {
        for (const timer of this._reloads.values()) {
            clearTimeout(timer);
        }
        this._reloads.clear();
    }
    async _agentRunning(model, activeAgentId) {
        const deviceId = this._requireDeviceId();
        const meshId = this._accountMeshId;
        if (!meshId) {
            return null;
        }
        const host = await this._runnableHost();
        const runs = (agent) => runnableModelName(agent.modelName, host) === model;
        const active = await this._currentAgent(activeAgentId, deviceId);
        if (active?.providerDeviceId && b4a.equals(active.providerDeviceId, deviceId) && runs(active)) {
            return active;
        }
        const { agents } = await this._engine.listAgents({ meshId, providerDeviceId: deviceId });
        return (agents ?? []).find(runs) ?? null;
    }
    unloadModel(name) {
        const pending = this._unloading.get(name);
        if (pending) {
            return pending;
        }
        const unloading = Promise.resolve()
            .then(() => this._unloadModel(name))
            .finally(() => this._unloading.delete(name));
        this._unloading.set(name, unloading);
        return unloading;
    }
    async _unloadModel(name) {
        if (!this._harness.unloadModel) {
            throw new CoreError('MODEL_RUNTIME_UNSUPPORTED', ['unload']);
        }
        const holders = [...this._runs.values()].filter((run) => run.executing && run.model === name);
        for (const run of holders) {
            run.controller.abort(MODEL_UNLOADED);
        }
        await Promise.allSettled(holders.map((run) => run.done));
        const { unloaded } = await this._harness.unloadModel({ model: name });
        this._log?.info('models', 'model unload requested', {
            model: name,
            unloaded,
            requeued: holders.length
        });
        return { unloaded };
    }
    async modelUsers(name) {
        const providerDeviceId = this._requireDeviceId();
        const host = await this._runnableHost();
        const { meshes } = await this._engine.listMeshes({});
        const scanned = await Promise.all((meshes ?? [])
            .filter((mesh) => mesh.open && !mesh.workspace)
            .map((mesh) => this._meshModelUsers(name, { meshId: mesh.meshId, providerDeviceId, host })));
        return { agents: scanned.flat() };
    }
    async _meshModelUsers(name, { meshId, providerDeviceId, host }) {
        const { agents } = await this._engine.listAgents({ meshId, providerDeviceId });
        const perAgent = await Promise.all((agents ?? []).map(async (agent) => {
            let models = modelsForAgent(agent, host);
            if (models.some((model) => model.use === 'music')) {
                const configs = await this._engine
                    .listToolConfigs({ agentId: agent.id, meshId })
                    .then((result) => result.configs ?? [])
                    .catch(() => []);
                models = modelsForAgent({ ...agent, musicModelChoice: musicModelChoiceOf(configs) }, host);
            }
            return models
                .filter((model) => model.name === name)
                .map(({ use }) => ({
                agentId: agent.id,
                meshId,
                agentName: agent.name,
                via: use
            }));
        }));
        return perAgent.flat();
    }
    async _runnableHost() {
        const capability = await this._ensureCapability();
        return capability && { ...capability, mobile: this._mobileClass };
    }
    notifyModelCatalog() {
        this._modelCatalog.notify();
    }
    cachedModelsChanged() {
        this._modelCatalog.notify();
        this._reportCapabilities().catch(noop);
    }
    async retryModelDownload(name) {
        if (!this._downloads) {
            throw new CoreError('MODEL_DOWNLOAD_UNAVAILABLE');
        }
        await this._downloads.retry(name);
    }
    async skills(agentId, modelName, options) {
        if (!this.opened)
            await this.ready();
        if (agentId) {
            const meshId = options?.meshId ?? this._accountMeshId;
            const agent = meshId ? await this._engine.getAgent({ agentId, meshId }).catch(noop) : null;
            const deviceId = this._deviceId;
            if (agent &&
                deviceId &&
                (!agent.providerDeviceId || !b4a.equals(agent.providerDeviceId, deviceId))) {
                agentId = null;
                options = { ...options, skipCredentialProbe: true };
            }
        }
        const resolved = (await this._harness.skills?.(agentId, modelName, options)) ?? [];
        this._recordSkillReadiness().catch(noop);
        return resolved;
    }
    async _recordSkillReadiness() {
        this._readinessDirty = true;
        if (this._recordingReadiness) {
            return;
        }
        this._recordingReadiness = true;
        try {
            while (this._readinessDirty) {
                this._readinessDirty = false;
                const ready = await this._readySkillNames();
                if (this._readySkills && sameNameList(this._readySkills, ready)) {
                    continue;
                }
                this._readySkills = ready;
                await this._reportCapabilities();
            }
        }
        finally {
            this._recordingReadiness = false;
        }
    }
    async _readySkillNames() {
        const unscoped = (await this._harness.skills?.(null, null, { skipCredentialProbe: true })) ?? [];
        const ready = unscoped.filter((skill) => isSetUpHere(skill.status)).map((skill) => skill.name);
        const deviceId = this._deviceId;
        const meshId = this._accountMeshId;
        if (deviceId && meshId) {
            const { agents } = await this._engine.listAgents({ meshId, providerDeviceId: deviceId });
            for (const agent of agents ?? []) {
                const resolved = (await this._harness.skills?.(agent.id, agent.modelName, {
                    skipCredentialProbe: true
                })) ?? [];
                ready.push(...encodeAgentSkillReadiness(agent.id, resolved.filter((skill) => isSetUpHere(skill.status)).map((skill) => skill.name)));
            }
        }
        return ready.sort();
    }
    async tools() {
        return (await this._harness.tools?.()) ?? [];
    }
    _supervisedWatch(label, run) {
        let running = false;
        let again = false;
        let stopped = false;
        const settle = (err) => {
            running = false;
            if (err !== null && !stopped && !isCoreError(err, 'MESH_NOT_FOUND')) {
                this._log?.error('assistant', `${label} watch failed`, err);
            }
            if (again) {
                start();
            }
        };
        const start = () => {
            again = false;
            if (this.closing || this.suspended) {
                return;
            }
            if (running) {
                again = true;
                return;
            }
            running = true;
            stopped = false;
            run().then(() => settle(null), (err) => settle(err));
        };
        const stop = () => {
            again = false;
            stopped = true;
        };
        return { start, stop };
    }
    async _reclaimDeletedChats(frames, servedIn) {
        let known = null;
        let agents = new Map();
        for await (const frame of frames) {
            if (this.closing || this.suspended)
                return;
            const ids = (frame.chats ?? []).map((chat) => chat.id);
            const gone = new Set(known === null ? [] : disappearedChatIds(known, ids));
            if (known !== null) {
                for (const chatId of gone) {
                    this._dropDeletedChat(chatId);
                }
            }
            for (const chat of frame.chats ?? []) {
                const before = agents.get(chat.id);
                if (before && before !== chat.agentId) {
                    void this._dropServedKvCache(chat.id, before);
                }
            }
            known = new Set(ids);
            agents = new Map((frame.chats ?? []).map((chat) => [chat.id, chat.agentId]));
            if (servedIn) {
                this._servedChats.set(servedIn, known);
            }
            await this._sweepImageCache(gone);
            await this._sweepInferenceCalls();
        }
    }
    async _dropServedKvCache(chatId, agentId) {
        for (const key of this._roundHost?.left(chatId, agentId) ?? []) {
            try {
                await this._harness.deleteKvCache?.(key);
            }
            catch (err) {
                this._log?.warn('assistant', 'served kv-cache deletion failed', { chatId, err });
            }
        }
    }
    _dropDeletedChat(chatId) {
        for (const run of this._runs.values()) {
            if (run.chatId === chatId) {
                run.controller.abort(RUN_SETTLED);
            }
        }
        this._reconciledCompactions.delete(chatId);
        void this._deleteChatKvCache(chatId, 'chat deleted').finally(() => this._runReplay
            .forget(chatId)
            .catch((err) => this._log?.warn('assistant', 'run replay not dropped', { err })));
        void this._inferenceCalls
            .forget(chatId)
            .catch((err) => this._log?.warn('assistant', 'inspector records not dropped', { err }));
    }
    async _followAgentEdits(meshId, frames) {
        let known = null;
        for await (const frame of frames) {
            if (this.closing || this.suspended)
                return;
            const agents = frame.agents ?? [];
            this._followHosted(meshId, agents);
            for (const agent of agents) {
                const previous = known?.get(agent.id);
                if (!previous) {
                    continue;
                }
                if (agentRekeyFingerprint(previous) !== agentRekeyFingerprint(agent)) {
                    void this._reclaimAgentChatCaches(meshId, agent);
                }
                if (!sameLoadSettings(previous, agent)) {
                    this._scheduleModelReload(agent);
                }
            }
            known = new Map(agents.map((agent) => [agent.id, agent]));
        }
    }
    async _reclaimAgentChatCaches(meshId, agent) {
        try {
            const { chats } = await this._engine.listChats({ meshId });
            for (const chat of chats ?? []) {
                if (chat.agentId === agent.id) {
                    await this._deleteChatKvCache(chat.id, 'agent re-key');
                }
            }
        }
        catch (err) {
            this._log?.warn('assistant', 'agent re-key cache reclaim failed', { agentId: agent.id, err });
        }
    }
    async _reconcileCompaction(engine, chatId) {
        const deviceId = this._requireDeviceId();
        const { chunks } = await engine
            .listChunks({ chatId, type: 'compaction' })
            .catch(() => ({ chunks: [] }));
        let newest = null;
        for (const chunk of chunks ?? []) {
            if (!newest || chunk.seq > newest.seq) {
                newest = chunk;
            }
        }
        if (!newest || (newest.originDeviceId && b4a.equals(newest.originDeviceId, deviceId))) {
            return;
        }
        if (this._reconciledCompactions.get(chatId) === newest.id) {
            return;
        }
        const gone = await this._deleteChatKvCache(chatId, 'compaction from another device');
        if (gone) {
            this._reconciledCompactions.set(chatId, newest.id);
        }
    }
    async deleteChatKvCache(chatId) {
        const result = (await this._harness.deleteKvCache?.(chatKvCacheKey(chatId))) ?? {
            status: 'unsupported',
            error: 'Harness does not support KV cache deletion'
        };
        if (result.status === 'success') {
            await this._runReplay.forget(chatId, LOCAL_HOLDER);
        }
        return result;
    }
    async clearKvCache() {
        const result = await harnessClearKvCache(this._harness)();
        if (result.status === 'success') {
            await this._runReplay.clear(LOCAL_HOLDER);
        }
        return result;
    }
    async _clearPreReplayCaches() {
        if (await this._runReplay.started())
            return;
        const result = await this.clearKvCache();
        if (result.status === 'failure') {
            this._log?.warn('assistant', 'pre-replay kv caches not cleared', { error: result.error });
            return;
        }
        await this._runReplay.start();
    }
    _inspectCall(inspecting, chatId, entry) {
        if (!inspecting)
            return;
        void this._inferenceCalls
            .record(chatId, entry)
            .catch((err) => this._log?.warn('assistant', 'inference call not recorded', { err }));
    }
    _inspectSent(inspecting, chatId, sent) {
        if (!inspecting)
            return;
        void this._inferenceCalls
            .recordSent(chatId, sent)
            .catch((err) => this._log?.warn('assistant', 'sent slice not recorded', { err }));
    }
    async _sentRuns(chatId, rounds) {
        const served = replayFromChunks(rounds);
        try {
            const sentRuns = await this._runReplay.load({ holder: LOCAL_HOLDER, chatId });
            for (const [runId, turns] of served.sentRuns) {
                sentRuns.set(runId, turns);
            }
            return {
                sentRuns,
                askedRuns: await this._runReplay.loadAsked({ holder: LOCAL_HOLDER, chatId }),
                readRuns: served.readRuns
            };
        }
        catch (err) {
            this._log?.warn('assistant', 'run replay unreadable', { chatId, err });
            await this._deleteChatKvCache(chatId, 'run replay unreadable');
            return { sentRuns: new Map(), askedRuns: new Map(), readRuns: new Map() };
        }
    }
    async _recordSentRun(chatId, { runId, turns, asked }) {
        if (turns) {
            try {
                await this._runReplay.save({ holder: LOCAL_HOLDER, chatId }, runId, {
                    messages: turns,
                    asked
                });
                return;
            }
            catch (err) {
                this._log?.warn('assistant', 'run replay not saved', { chatId, runId, err });
            }
        }
        await this._deleteChatKvCache(chatId, 'run not replayable as sent');
    }
    async _deleteChatKvCache(chatId, reason) {
        try {
            const result = await this.deleteChatKvCache(chatId);
            if (result.status === 'failure') {
                this._log?.warn('assistant', 'chat kv-cache deletion failed', {
                    chatId,
                    reason,
                    error: result.error
                });
                return false;
            }
            return true;
        }
        catch (err) {
            this._log?.warn('assistant', 'chat kv-cache deletion failed', { chatId, reason, err });
            return false;
        }
    }
    async _watchMeshList() {
        this._meshList = this._engine.meshesWatch({});
        for await (const { meshes } of this._meshList) {
            if (this.closing || this.suspended)
                return;
            this._syncMeshConsumers(meshes ?? []);
        }
    }
    async _watchAccount() {
        this._accountFrames = this._engine.accountWatch({});
        try {
            for await (const account of this._accountFrames) {
                if (this.closing || this.suspended)
                    return;
                this._followAccount(account);
                this._accountSeen.resolve();
            }
        }
        finally {
            this._accountSeen.resolve();
        }
    }
    _syncMeshConsumers(meshes) {
        this._listed = meshes;
        const consumed = meshes.filter((mesh) => mesh.open && mesh.meshId !== this._ownWorkspace);
        const open = new Set(consumed.map((mesh) => mesh.meshId));
        const served = new Set(consumed.filter((mesh) => mesh.served).map((mesh) => mesh.meshId));
        for (const [meshId, consumer] of this._meshConsumers) {
            if (open.has(meshId))
                continue;
            consumer.stop();
            this._meshConsumers.delete(meshId);
            this._pruneSeen(meshId, new Set());
            for (const chatId of this._servedChats.get(meshId) ?? []) {
                void this._deleteChatKvCache(chatId, 'served mesh left');
            }
            this._servedChats.delete(meshId);
        }
        for (const meshId of open) {
            const consumer = this._meshConsumers.get(meshId) ?? this._meshConsumer(meshId, served.has(meshId));
            this._meshConsumers.set(meshId, consumer);
            consumer.start();
        }
    }
    _followAccount(account) {
        this._accountMeshId = account.meshId ?? null;
        if ((account.ownWorkspace ?? null) !== this._ownWorkspace) {
            this._ownWorkspace = account.ownWorkspace ?? null;
            this._syncMeshConsumers(this._listed);
        }
        const on = account.meshId ? `${account.meshId}:${account.writable}` : null;
        if (on === null) {
            this._advertisedOn = null;
            return;
        }
        if (on === this._advertisedOn) {
            return;
        }
        this._advertisedOn = on;
        this._downloads?.meshAdopted();
        this._lastCapabilities.clear();
        void this._reportCapabilities();
        void this._reconcileDeviceProfile();
        this._triggerModelWarm();
    }
    _meshConsumer(meshId, served) {
        const watches = [
            this._streamWatch(`chat-list:${meshId}`, () => this._engine.chatsWatch({ meshId }), (frames) => this._reclaimDeletedChats(frames, served ? meshId : null))
        ];
        if (!served) {
            watches.push(this._streamWatch(`run-requests:${meshId}`, () => this._engine.runRequestsWatch({ meshId }), (frames) => this._dispatchRunRequests(meshId, frames)), this._streamWatch(`agent:${meshId}`, () => this._engine.agentsWatch({ meshId }), (frames) => this._followAgentEdits(meshId, frames)));
        }
        const host = this._roundHost;
        if (host) {
            watches.push(this._streamWatch(`model-requests:${meshId}`, () => this._engine.modelRequestsWatch({ meshId }), (frames) => host.follow(meshId, frames)));
        }
        return {
            start: () => watches.forEach((watch) => watch.start()),
            stop: () => watches.forEach((watch) => watch.stop())
        };
    }
    _streamWatch(label, open, consume) {
        let frames = null;
        const watch = this._supervisedWatch(label, async () => {
            frames = open();
            return consume(frames);
        });
        return {
            start: () => watch.start(),
            stop: () => {
                watch.stop();
                frames?.destroy();
            }
        };
    }
    async _dispatchRunRequests(meshId, frames) {
        let opened = true;
        for await (const frame of frames) {
            if (this.closing || this.suspended)
                return;
            const chunks = frame.chunks ?? [];
            const deviceId = this._requireDeviceId();
            const handed = chunks.filter((chunk) => handedOff(chunk, deviceId));
            this._handedOff.set(meshId, handed);
            if (opened) {
                this._takeBackHandedOff(meshId);
            }
            opened = false;
            for (const chunk of chunks.filter((chunk) => !handed.includes(chunk))) {
                this._dispatch(chunk, meshId);
            }
            this._pruneSeen(meshId, new Set(chunks.map((chunk) => chunk.runId)));
        }
    }
    _takeBackHandedOff(only) {
        for (const [meshId, requests] of this._handedOff) {
            if (only && only !== meshId)
                continue;
            const engine = meshScoped(this._engine, meshId);
            for (const request of requests) {
                engine.takeRunRequest({ chunkId: request.id }).catch((err) => {
                    this._log?.debug('runs', 'taking a handed-off run back failed', err);
                });
            }
            this._handedOff.delete(meshId);
        }
    }
    _stopMeshIntake() {
        this._roundHost?.stop();
        this._meshListWatch.stop();
        this._accountWatch.stop();
        for (const consumer of this._meshConsumers.values()) {
            consumer.stop();
        }
        this._meshConsumers.clear();
        this._advertisedOn = null;
    }
    _pruneSeen(meshId, live) {
        for (const [runId, from] of this._seen) {
            if (from !== meshId || live.has(runId))
                continue;
            this._seen.delete(runId);
        }
    }
    _dispatch(request, meshId) {
        const runId = request.runId;
        if (!runId || this._runs.has(runId) || this._seen.has(runId)) {
            return;
        }
        this._seen.set(runId, meshId);
        const engine = meshScoped(this._engine, meshId);
        const settle = (async () => {
            const agentId = request.runRequest?.agentId;
            const agent = agentId ? await engine.getAgent({ agentId }).catch(noop) : undefined;
            if (!agent) {
                this._seen.delete(runId);
                return;
            }
            const deviceId = this._requireDeviceId();
            if (offeredTo(request, deviceId) && !(await this._isHandled(engine, request))) {
                if (this._backgrounded) {
                    this._seen.delete(runId);
                    if (this._state === QvacState.PRESUSPEND) {
                        this._parked.set(runId, () => this._dispatch(request, meshId));
                    }
                    return;
                }
                const taken = await engine.takeRunRequest({ chunkId: request.id }).catch(noop);
                if (!taken) {
                    this._seen.delete(runId);
                    return;
                }
                request = taken;
            }
            if (!drivenBy({ request, agent }, deviceId)) {
                return;
            }
            if (await this._isHandled(engine, request)) {
                return;
            }
            this._log?.info('runs', 'run claimed', { runId, chatId: request.chatId, agentId });
            if (!request.capability) {
                await this._offerSteer(engine, request, agent.id);
            }
            const controller = new AbortController();
            const prior = this._chats.get(request.chatId) ?? Promise.resolve();
            const done = prior.then(() => this._execute(request, agent, { controller, meshId, runId }));
            const link = done.catch(noop);
            this._chats.set(request.chatId, link);
            this._runs.set(runId, {
                controller,
                done,
                chatId: request.chatId,
                agentId: agent.id,
                model: agent.modelName,
                executing: false
            });
            try {
                await done;
            }
            finally {
                this._runImageCacheNames.delete(runId);
                this._runs.delete(runId);
                this._runsChanged();
                if (this._chats.get(request.chatId) === link) {
                    this._chats.delete(request.chatId);
                }
                void this._reportCapabilities();
                this._requeue(runId, controller.signal.reason, () => this._dispatch(request, meshId));
            }
        })();
        settle.catch((err) => this._log?.error('assistant', `run ${runId} failed`, err));
    }
    async _offerSteer(engine, request, agentId) {
        const running = [...this._runs.values()].find((run) => run.chatId === request.chatId && run.agentId === agentId && run.steering);
        if (!running?.steering || !request.runId) {
            return;
        }
        const asked = await engine.listChunks({ chatId: request.chatId, type: 'user-message' });
        const message = (asked.chunks ?? []).findLast((chunk) => chunk.seq < request.seq);
        const text = message?.userMessage?.text;
        if (text) {
            const [turn] = nameSenders([{ role: 'user', content: text, sender: senderOf(message) }]);
            running.steering.push({ mode: 'steer', text: turn.content, id: request.runId });
        }
    }
    _requeue(runId, reason, replay) {
        const background = this._backgroundReplays.delete(runId);
        if (this._seen.has(runId) || this.closing) {
            return;
        }
        if (background && this._state === QvacState.PRESUSPEND) {
            this._parked.set(runId, replay);
        }
        else if ((background && !this._backgrounded) || reason === MODEL_UNLOADED) {
            replay();
        }
    }
    async _citeWebSources(transcript, runId, result) {
        const records = webSourcesFromToolResult(result, WEB_RAG_SOURCE_BOUNDS);
        if (records.length === 0) {
            return;
        }
        try {
            await transcript.chunk({ type: 'sources', sources: { sources: records } });
        }
        catch (err) {
            this._log?.warn('assistant', 'web sources chunk skipped', { runId, err });
        }
    }
    async _searchKnowledge(engine, messages, { chatId, attachmentIds, signal, preparing }) {
        let lastUser;
        for (let index = messages.length - 1; index >= 0; index--) {
            if (messages[index].role === 'user') {
                lastUser = messages[index];
                break;
            }
        }
        const query = lastUser?.content.trim();
        if (!lastUser || !query) {
            return null;
        }
        try {
            const search = await searchKnowledge(engine, {
                chatId,
                query,
                attachmentIds: attachmentIds.length > 0 ? [...attachmentIds] : undefined
            }, { signal, preparing });
            if (!search.enabled) {
                return null;
            }
            if (!search.hasKnowledge && !notReadyCount(search)) {
                return null;
            }
            return { search, lastUser, hits: search.hits ?? [] };
        }
        catch (err) {
            if (err instanceof AbortedError) {
                return null;
            }
            this._log?.warn('assistant', 'knowledge search unavailable', err);
            return null;
        }
    }
    async _injectKnowledge(knowledge, sinks) {
        const injected = { documentsInjected: false, sourcesWritten: false, ragInjected: false };
        try {
            if (knowledge.search.errorMessage) {
                this._log?.warn('assistant', 'knowledge search failed', {
                    error: knowledge.search.errorMessage
                });
            }
            const fullTextOnly = knowledge.hits.length > 0 && knowledge.hits.every(isFullTextHit);
            if (fullTextOnly) {
                knowledge.lastUser.content = `${formatFullDocumentContext(knowledge.hits)}\n\nThe user's message:\n${knowledge.lastUser.content}`;
                injected.documentsInjected = true;
                if (knowledge.hits.some(isTruncatedFullTextHit)) {
                    await sinks.transcript.chunk({
                        type: 'sources',
                        sources: { sources: [], notice: RAG_TRUNCATED_NOTICE, ...notReady(knowledge.search) }
                    });
                    injected.sourcesWritten = true;
                }
            }
            else {
                await injectRetrievedKnowledge(knowledge, { ...sinks, injected });
            }
            const line = notReadyLine(knowledge.search);
            if (line) {
                knowledge.lastUser.content += `\n\n${line}`;
            }
        }
        catch (err) {
            this._log?.warn('assistant', 'knowledge injection skipped', err);
        }
        return injected;
    }
    async _writeUnreadNotice(transcript, reason, search) {
        try {
            await transcript.chunk({
                type: 'sources',
                sources: {
                    sources: [],
                    notice: reason === 'knowledge-off' ? RAG_KNOWLEDGE_OFF_NOTICE : RAG_UNAVAILABLE_NOTICE,
                    ...(search && notReady(search))
                }
            });
        }
        catch (err) {
            this._log?.warn('assistant', 'unread-document notice skipped', err);
        }
    }
    async _openRunLog(engine, runId) {
        if (!keepsRunLog(await this._ensureCapability())) {
            return null;
        }
        const runLog = createHostRunLogAdapter(engine);
        try {
            return { runLog, lease: await runLog.begin(runId) };
        }
        catch (err) {
            this._log?.warn('runs', 'run log not opened', { runId, err });
            return null;
        }
    }
    async _isHandled(engine, request) {
        const { chunks } = await engine.listChunks({
            chatId: request.chatId,
            type: 'run-status'
        });
        return (chunks ?? []).some((c) => c.runId === request.runId && TERMINAL_STATES.has(c.runStatus?.state ?? ''));
    }
    async _execute(request, agent, { controller, meshId, runId }) {
        const engine = meshScoped(this._engine, meshId);
        const { chatId } = request;
        this._suggesting.get(chatId)?.abort(SUGGESTION_SUPERSEDED);
        const deviceId = this._requireDeviceId();
        if (this._backgrounded) {
            this._seen.delete(runId);
            this._backgroundReplays.add(runId);
            return;
        }
        if (await this._isHandled(engine, request)) {
            return;
        }
        const fresh = await engine.getAgent({ agentId: agent.id }).catch(noop);
        if (!fresh || fresh.deletedAt || !drivenBy({ request, agent: fresh }, deviceId)) {
            return;
        }
        agent = fresh;
        const capability = request.capability;
        if (capability) {
            return this._invokeCapability({
                engine,
                request,
                agent,
                capability,
                controller,
                meshId,
                runId
            });
        }
        const steeredInto = this._steered.get(runId);
        if (steeredInto) {
            this._steered.delete(runId);
            const steered = new RunTranscript(engine, {
                chatId,
                runId,
                deviceId,
                model: agent.modelName,
                log: this._log
            });
            steered.close();
            await steered.status({ state: 'completed', reason: STEERED, metrics: { steeredInto } });
            return;
        }
        const hold = await this._openRunLog(engine, runId);
        const runLog = hold?.runLog;
        const resumed = Boolean(hold?.lease.boot?.metadata);
        const releaseRunLog = async () => {
            await hold?.runLog
                .release(runId, hold.lease.generation)
                .catch((err) => this._log?.warn('runs', 'run log not released', { runId, err }));
        };
        if (!resumed) {
            await this._reconcileCompaction(engine, chatId);
            if (request.parentId) {
                await this._deleteChatKvCache(chatId, 'superseding run');
            }
        }
        const model = runnableModelName(agent.modelName, await this._runnableHost());
        if (model !== agent.modelName) {
            this._log?.warn('runs', 'model clamped to what this device can run', {
                runId,
                chatId,
                requested: agent.modelName,
                model
            });
        }
        const claimed = this._runs.get(runId);
        if (claimed) {
            this._runs.set(runId, { ...claimed, model });
        }
        const config = await engine.getConfig({}).catch(noop);
        const configuredAgent = withConfigDefaults(agent, config);
        this._log?.info('runs', 'run model resolved', {
            runId,
            model,
            agentModel: agent.modelName,
            warmedModel: this._warmedModelName
        });
        const transcript = new RunTranscript(engine, {
            chatId,
            runId,
            deviceId,
            model,
            log: this._log
        });
        const rounds = new OwnerRounds({
            engine,
            chatId,
            runId,
            agentId: agent.id,
            deviceId,
            from: request.seq,
            media: (file) => this._mediaRefs.get(path.basename(file))
        });
        const folded = !resumed &&
            (await this._compactIfNearFull({
                chatId,
                transcript,
                trigger: 'before-run',
                signal: controller.signal,
                meshId,
                run: { request, runId },
                rounds
            }));
        const toolConfigsPromise = this._loadToolConfigs(engine, agent.id);
        const fsGrantsPromise = this._loadFsGrants(agent.id);
        const all = await listHistoryChunks(engine, chatId);
        const { chunks: switches } = await engine.listChunks({ chatId, type: 'agent-switch' });
        const ranAndSwitched = [...all, ...(switches ?? [])].sort((a, b) => a.seq - b.seq);
        if (!resumed && agentSwitched(ranAndSwitched, request, deviceId)) {
            await this._deleteChatKvCache(chatId, 'agent switched');
        }
        const { chunks: priorAsks } = await engine.listChunks({
            chatId,
            type: 'approval-request'
        });
        const { history, stale, repair: currentRepair, acceptedRepairs } = runPromptView(all, priorAsks ?? [], { request, runId });
        const { chunks: priorResults } = await engine.listChunks({ chatId, type: 'tool-result' });
        let ran = (priorResults ?? []).some((chunk) => chunk.runId === runId &&
            chunk.toolResult?.name !== SKILL_TOOL &&
            !isDeniedResult(chunk.toolResult?.result));
        let replay = await this._sentRuns(chatId, await listRoundChunks(engine, chatId));
        if (!resumed && viewOutgrewCache(all, { request, runId }, replay.sentRuns)) {
            await this._deleteChatKvCache(chatId, 'a run outside the cached view');
            replay = { sentRuns: new Map(), askedRuns: new Map(), readRuns: new Map() };
        }
        const messages = historyFromChunks(history, stale, replay);
        const typedText = currentRepair
            ? undefined
            : history.findLast((chunk) => chunk.userMessage)?.userMessage?.text;
        if (currentRepair) {
            messages.push({ role: 'user', content: currentRepair.promptText });
        }
        const diagramRepair = currentRepair !== undefined;
        const runAgent = diagramRepair
            ? {
                ...configuredAgent,
                toolsScope: 'selected',
                enabledTools: [],
                skillsScope: 'selected',
                enabledSkills: []
            }
            : configuredAgent;
        const carriesMedia = messages.some((turn) => turn.images?.length || turn.pdfs?.length || turn.videos?.length);
        const seesImages = carriesMedia && (await this._seesImages(model));
        let unreadableImages = new Map();
        const sampled = [];
        rounds.share = async (agentId) => {
            const host = await engine.getAgent({ agentId }).catch(() => null);
            if (sampled.length && host && !b4a.equals(host.providerDeviceId, deviceId)) {
                await this._storeVideoDigests(sampled.splice(0), { meshId, chatId, runId, deviceId });
            }
        };
        let pdfPages = { rendered: new Set(), cuts: [] };
        if (!seesImages) {
            const dropped = messages.reduce((count, turn) => count + (turn.images?.length ?? 0), 0);
            if (dropped && (this._harness.supportsImages ?? this._info.supportsImages)) {
                this._log?.warn('assistant', `no projection pairing for ${model} — dropped ${dropped} image(s)`);
            }
            for (const turn of messages) {
                if (turn.images?.length) {
                    const names = turn.images.map((image) => image.fileName).join(', ');
                    turn.content += `\n[Attached image${turn.images.length > 1 ? 's' : ''}: ${names} — not visible to this model]`;
                }
                delete turn.images;
                delete turn.pdfs;
            }
        }
        else {
            unreadableImages = await this._hydrateImages(messages, controller.signal, runId);
        }
        const settledWatch = this._watchSettled(engine, { chatId, runId, controller });
        const ownershipWatch = this._watchOwnership(engine, { request, agentId: agent.id, controller });
        let readinessError = null;
        const held = { status: null };
        try {
            await this._downloads?.waitUntilCached(model, controller.signal, {
                onHold: () => {
                    held.status = transcript.status({ state: 'executing', progress: { phase: 'awaiting-download', model } }, { resumed });
                }
            });
        }
        catch (err) {
            readinessError = err instanceof Error ? err : new Error(String(err));
        }
        if (controller.signal.aborted) {
            try {
                const outcome = this._abortOutcome(runId, controller.signal.reason);
                if (outcome.kind === 'replay') {
                    this._seen.delete(runId);
                }
                if (outcome.kind === 'failed') {
                    await transcript.status({ state: 'failed', reason: outcome.reason });
                }
            }
            finally {
                transcript.close();
                ownershipWatch.stop();
                settledWatch.stop();
                await releaseRunLog();
            }
            return;
        }
        if (readinessError) {
            try {
                await transcript.status({ state: 'failed', reason: runFailureNotice(readinessError) });
            }
            finally {
                transcript.close();
                ownershipWatch.stop();
                settledWatch.stop();
                await releaseRunLog();
            }
            return;
        }
        const inflight = this._runs.get(runId);
        if (inflight) {
            this._runs.set(runId, { ...inflight, executing: true });
        }
        this._runsChanged();
        const busyChatId = this._modelHolder(runId, chatId, model);
        const runStatus = busyChatId
            ? { state: 'executing', progress: { phase: 'queued', busyChatId } }
            : { state: 'executing' };
        const runStatusId = (await (held.status ?? transcript.status(runStatus, { resumed }))).id;
        if (held.status) {
            await transcript.progress(runStatusId, runStatus);
        }
        const approvals = this._createApprove(engine, {
            chatId,
            runId,
            deviceId,
            agentId: agent.id,
            hasRun: () => ran
        });
        const idle = idleWatch(controller, this._runIdleTimeoutMs);
        const modelWatch = this._watchModelProgress((runStatus) => transcript.progress(runStatusId, runStatus), busyChatId !== null);
        let metrics;
        const sourceTagFilter = createRagSourceTagFilter();
        const retrievedRecords = [];
        const answers = new Map();
        let round;
        const answer = (text) => {
            answers.set(round, (answers.get(round) ?? '') + text);
        };
        const flushTranscript = async () => {
            const tail = sourceTagFilter.flush();
            if (tail) {
                answer(tail);
                await transcript.text('content', tail, round);
            }
            await transcript.flush();
        };
        let titleOutcome = null;
        let runFailure = null;
        let runVerdict = 'completed';
        let sentRun = null;
        let steering = null;
        const taken = new Set();
        let inputLength = 0;
        let asked;
        const writeText = async (type, raw) => {
            const text = type === 'content' ? sourceTagFilter.push(raw) : raw;
            if (!text) {
                return;
            }
            if (type === 'content') {
                answer(text);
            }
            await transcript.text(type, text, round);
        };
        const writeRoundText = async (type, text) => {
            if (!rounds.echoed(type, text)) {
                await writeText(type, text);
            }
            else if (type === 'content') {
                answer(text);
            }
        };
        const failRun = async (message) => {
            const folded = isContextOverflowFailure(message) &&
                (await this._runCompaction({
                    chatId,
                    transcript,
                    trigger: 'overflow',
                    signal: controller.signal,
                    meshId,
                    run: { request, runId },
                    rounds
                }));
            runFailure = runFailureNotice(message);
            await transcript.status({ state: 'failed', reason: runFailure, metrics });
            if (folded) {
                await engine
                    .runAgent({ chatId, agentId: agent.id, parentRunId: runId })
                    .catch((err) => this._log?.warn('runs', 'compaction retry not queued', { runId, err }));
            }
            titleOutcome = 'ended';
        };
        const endAbortedRun = async () => {
            const outcome = this._abortOutcome(runId, controller.signal.reason);
            if (outcome.kind === 'replay') {
                runVerdict = 'replay';
                this._seen.delete(runId);
                return;
            }
            if (outcome.kind === 'handoff') {
                runVerdict = 'handoff';
                return;
            }
            runFailure = outcome.reason;
            await transcript.status({ state: 'failed', reason: outcome.reason, metrics });
            titleOutcome = 'ended';
        };
        const pauseRun = async () => {
            if (this._abortOutcome(runId, controller.signal.reason).kind === 'replay') {
                await transcript.status({ state: 'paused', reason: RUN_PAUSED });
            }
            await endAbortedRun();
            if (runVerdict === 'replay') {
                runVerdict = 'paused';
            }
        };
        const resetRound = async (event) => {
            round = roundOf(event);
            const replaced = replacedTypes(event);
            if (replaced.includes('content')) {
                answers.delete(round);
            }
            if (!rounds.retook()) {
                await transcript.roundReset(round ?? 0, replaced);
            }
        };
        const holdForRecovery = async (event) => {
            runVerdict = 'recovery-required';
            await transcript.status({ state: 'recovery-required', reason: recoveryReason(event) });
            titleOutcome = 'ended';
        };
        const recordToolResult = async (event) => {
            if (isDeniedResult(event.result)) {
                this._log?.info('approvals', 'tool ran denied', { runId, tool: event.name });
            }
            else if (event.name !== SKILL_TOOL) {
                ran = true;
            }
            if (WEB_TOOLS.includes(String(event.name))) {
                await this._citeWebSources(transcript, runId, event.result);
            }
            await transcript.chunk(toolResultChunk(event));
        };
        try {
            const attachTurnIds = resumed ? [] : attachTurnDocumentIds(history);
            if (attachTurnIds.length > 0) {
                backfillDocumentOnlyTurn(messages);
            }
            const knowledge = !resumed &&
                !diagramRepair &&
                (toolsetEnabled('knowledge', runAgent.disabledToolsets) || attachTurnIds.length > 0)
                ? await this._searchKnowledge(engine, messages, {
                    chatId,
                    attachmentIds: attachTurnIds,
                    signal: controller.signal,
                    preparing: modelWatch.documents
                })
                : null;
            if (controller.signal.aborted) {
                const outcome = this._abortOutcome(runId, controller.signal.reason);
                if (outcome.kind === 'replay') {
                    runVerdict = 'replay';
                    this._seen.delete(runId);
                    return;
                }
                if (outcome.kind === 'handoff') {
                    runVerdict = 'handoff';
                    return;
                }
                runFailure = outcome.reason;
                await transcript.status({ state: 'failed', reason: outcome.reason, metrics });
                return;
            }
            const injected = knowledge
                ? await this._injectKnowledge(knowledge, { transcript, sourceTagFilter, retrievedRecords })
                : { documentsInjected: false, sourcesWritten: false, ragInjected: false };
            const hasAudio = messages.some((turn) => turn.audioAttachments?.length || turn.videos?.length);
            if (hasAudio) {
                modelWatch.transcribe(true);
            }
            await this._hydrateAudio(messages, controller.signal);
            if (messages.some((turn) => turn.videos?.length)) {
                await this._hydrateVideos(messages, {
                    signal: controller.signal,
                    runId,
                    seesImages,
                    reading: await this._contextReading({ chatId, meshId, folded }, configuredAgent.ctxSize),
                    sampled
                });
            }
            if (hasAudio) {
                modelWatch.transcribe(false);
            }
            backfillImageOnlyTurns(messages);
            if (seesImages) {
                pdfPages = await this._hydratePdfPages(messages, {
                    signal: controller.signal,
                    runId,
                    window: { ctxSize: configuredAgent.ctxSize, modelName: model }
                });
            }
            annotateDocumentAttachments(messages);
            for (const { turn, notice } of pdfPages.cuts) {
                turn.content = `${turn.content}\n${notice}`;
            }
            const unreadIds = attachTurnIds.filter((id) => !pdfPages.rendered.has(id));
            if (!diagramRepair && unreadIds.length > 0 && !injected.documentsInjected) {
                const reason = documentUnreadReason({
                    knowledgeOn: toolsetEnabled('knowledge', runAgent.disabledToolsets),
                    failedFiles: knowledge?.search?.failedFiles,
                    attachedCount: unreadIds.length
                });
                const lastUser = messages.findLast((turn) => turn.role === 'user');
                if (lastUser) {
                    lastUser.content = `${lastUser.content}\n${documentUnreadNotice(reason, unreadIds.length > 1)}`;
                }
                if (!injected.sourcesWritten) {
                    await this._writeUnreadNotice(transcript, reason, knowledge?.search);
                }
            }
            annotateUnreadableImages(unreadableImages);
            const toolConfigs = await toolConfigsPromise;
            const { roots, write } = await fsGrantsPromise;
            const { grantedDirs, grantedDrives, driveOp } = await resolveFsGrants(roots, this._drives, (key, err) => this._log?.warn('assistant', 'drive grant dropped', {
                key,
                error: errorMessage(err)
            }));
            if (await this._isHandled(engine, request)) {
                return;
            }
            const cacheKey = diagramRepair || stale.runIds.size > 0
                ? undefined
                : chatRepairKvCacheKey(chatId, acceptedRepairs);
            sentRun = trackSentRun(cacheKey);
            const unloading = this._unloading.get(model);
            if (unloading) {
                await raceAbort(unloading.catch(noop), controller.signal);
            }
            this._log?.info('runs', 'completion requested', {
                runId,
                model,
                cacheKey,
                turns: messages.length
            });
            const resent = loggedMessages(hold?.lease.boot);
            if (resent) {
                asked = askedIn(resent, messages.findLast((turn) => turn.role === 'user')?.sender);
            }
            else {
                restoreSentContent(messages);
                asked = messages.findLast((turn) => turn.role === 'user')?.content;
            }
            const input = resent ?? nameSenders(messages);
            inputLength = input.length;
            rounds.inputLength = inputLength;
            const inspecting = await this._capturingInferenceCalls();
            steering = new RunInputQueue();
            const inflight = this._runs.get(runId);
            if (inflight) {
                inflight.steering = steering;
            }
            idle.touch();
            const events = this._harness.completion({
                runId,
                runLog,
                model,
                agent: runAgent,
                messages: input,
                typedText,
                cacheKey,
                replaysContext: true,
                deferTools: runAgent.shared === true || !!request.requesterMemberId,
                modelRound: idle.parks(rounds.port),
                session: chatKvCacheKey(chatId),
                thinkingDefault: thinkingDefault(config),
                toolConfigs,
                grantedDirs,
                grantedDrives,
                driveOp,
                grantedWriteDirs: write,
                approve: idle.parks(approvals.approve),
                attach: (input) => this._uploadGenerated(input, { meshId, chatId, runId, deviceId }),
                fetchAttachment: (query) => this._fetchAttachment(engine, chatId, query),
                progress: (update) => {
                    idle.touch();
                    modelWatch.image(update);
                },
                generationParams: diagramRepair ? { reasoning_budget: 0 } : undefined,
                captureInferenceCalls: true,
                input: steering,
                signal: controller.signal
            });
            let harnessEvents = 0;
            for await (const event of events) {
                harnessEvents++;
                idle.touch();
                modelWatch.clear();
                if (isHarnessEvent(event, 'content') || isHarnessEvent(event, 'thinking')) {
                    round = roundOf(event) ?? round;
                    await writeRoundText(event.type, event.text);
                    continue;
                }
                if (event.type === 'run-started' ||
                    event.type === 'run-resumed' ||
                    event.type === 'context') {
                    continue;
                }
                if (event.type === 'input' && typeof event.id === 'string') {
                    taken.add(event.id);
                    continue;
                }
                if (event.type === 'metrics') {
                    const { type, ...rest } = event;
                    metrics = rest;
                    recordBackends(this._backendUse, rest.backends);
                    this._log?.info('runs', 'run metrics', { runId, ...runMetricsSummary(rest) });
                    continue;
                }
                if (event.type === 'inference-sent') {
                    this._inspectSent(inspecting, chatId, {
                        runId,
                        round: Number(event.round ?? 0),
                        messages: event.messages,
                        tokens: event.tokens,
                        outcome: event.outcome,
                        reason: event.reason
                    });
                    continue;
                }
                if (event.type === 'inference-call') {
                    const call = asRecord(event.call);
                    sentRun?.observe(call);
                    this._inspectCall(inspecting, chatId, { runId, at: Date.now(), call });
                    continue;
                }
                await flushTranscript();
                if (event.type === 'error' && !this._backgrounded) {
                    await failRun(event.message);
                    return;
                }
                if (event.type === 'error') {
                    this._log?.info('runs', 'background error replayed', { runId, message: event.message });
                }
                if (event.type === 'error' || event.type === 'aborted') {
                    await endAbortedRun();
                    return;
                }
                if (event.type === 'paused') {
                    await pauseRun();
                    return;
                }
                if (event.type === 'recovery-required') {
                    await holdForRecovery(event);
                    return;
                }
                if (event.type === 'round-reset') {
                    await resetRound(event);
                    continue;
                }
                if (isHarnessEvent(event, 'tool-call')) {
                    this._log?.info('runs', 'tool call', { runId, name: event.name });
                    await transcript.chunk(toolCallChunk(event));
                }
                else if (isHarnessEvent(event, 'tool-result')) {
                    await recordToolResult(event);
                }
                else if (isHarnessEvent(event, 'tool-activity')) {
                    void engine
                        .recordToolActivity({
                        agentId: runAgent.id,
                        toolName: event.name,
                        decision: event.decision,
                        effect: event.effect,
                        arguments: event.args,
                        resource: event.resource ?? undefined,
                        chatId,
                        runId,
                        at: Date.now()
                    })
                        .catch((err) => this._log?.warn('runs', 'tool activity record failed', { runId, err }));
                }
                else {
                    this._log?.warn('assistant', 'unknown harness event dropped', { type: event.type });
                }
            }
            this._log?.info('runs', 'harness stream ended', { runId, events: harnessEvents });
            if (await settledWithin(flushTranscript(), FINAL_FLUSH_MS)) {
                this._log?.info('runs', 'final flush done', { runId });
            }
            else {
                this._log?.warn('runs', 'completing over a stranded flush', {
                    runId,
                    pending: transcript.pending()
                });
            }
            const citedTitles = injected.ragInjected
                ? citedByPhraseOverlap([...answers.values()].join(''), retrievedRecords)
                : null;
            if (sentRun?.used && !rounds.rounds) {
                await this._recordSentRun(chatId, { runId, turns: sentRun.turns(inputLength), asked });
            }
            sentRun = null;
            await transcript.status({
                state: 'completed',
                metrics: citedTitles ? { ...metrics, citedTitles } : metrics
            });
            titleOutcome = 'completed';
            for (const id of taken) {
                this._steered.set(id, runId);
            }
            await this._storeVideoDigests(sampled, { meshId, chatId, runId, deviceId });
        }
        catch (err) {
            const outcome = controller.signal.aborted
                ? this._abortOutcome(runId, controller.signal.reason)
                : null;
            if (outcome?.kind === 'replay') {
                runVerdict = 'replay';
                this._seen.delete(runId);
                return;
            }
            if (outcome?.kind === 'handoff') {
                runVerdict = 'handoff';
                return;
            }
            await flushTranscript();
            runFailure = runFailureNotice(err);
            await transcript.status({ state: 'failed', reason: runFailure, metrics });
            titleOutcome = 'ended';
        }
        finally {
            steering?.close();
            if (sentRun?.used) {
                await this._recordSentRun(chatId, { runId, turns: null });
            }
            void this._inferenceCalls
                .recordOutcome(chatId, {
                runId,
                outcome: runFailure ? 'failed' : runVerdict,
                reason: runFailure
            })
                .catch((err) => this._log?.warn('assistant', 'run outcome not recorded', { err }));
            transcript.close();
            idle.stop();
            modelWatch.stop();
            ownershipWatch.stop();
            await approvals.settle({ preservePending: isLifecycleTeardown(controller.signal.reason) });
            settledWatch.stop();
            await releaseRunLog();
            if (titleOutcome && !diagramRepair) {
                const completed = titleOutcome === 'completed';
                const answerText = [...answers.values()].join('');
                void this._autoTitle(engine, {
                    chatId,
                    messages,
                    model,
                    agent: runAgent,
                    probe: completed,
                    rounds
                }).then(() => completed && answerText.trim()
                    ? this._suggestNext(engine, {
                        chatId,
                        runId,
                        messages,
                        answer: answerText,
                        model,
                        agent: runAgent,
                        rounds
                    })
                    : undefined);
            }
        }
    }
    async _invokeCapability({ engine, request, agent, capability, controller, meshId, runId }) {
        const { chatId } = request;
        const deviceId = this._requireDeviceId();
        const harness = this._harness;
        const transcript = new RunTranscript(engine, {
            chatId,
            runId,
            deviceId,
            model: '',
            log: this._log
        });
        const inflight = this._runs.get(runId);
        if (inflight) {
            this._runs.set(runId, { ...inflight, executing: true, model: '' });
        }
        this._runsChanged();
        const executing = await transcript.status({ state: 'executing' });
        const modelWatch = this._watchModelProgress((runStatus) => transcript.progress(executing.id, runStatus));
        const settledWatch = this._watchSettled(engine, { chatId, runId, controller });
        const ownershipWatch = this._watchOwnership(engine, { request, agentId: agent.id, controller });
        let metrics;
        const endAbortedCapability = async () => {
            const outcome = this._abortOutcome(runId, controller.signal.reason);
            if (outcome.kind === 'replay') {
                this._seen.delete(runId);
            }
            if (outcome.kind === 'failed') {
                await transcript.status({ state: 'failed', reason: outcome.reason, metrics });
            }
        };
        this._log?.info('runs', 'capability requested', { runId, capability });
        try {
            if (!harness.invoke) {
                await transcript.status({
                    state: 'failed',
                    reason: RUN_FAILURE_REASONS.capabilityUnavailable
                });
                return;
            }
            const events = harness.invoke({
                capability,
                args: isRecord(request.capabilityArgs) ? request.capabilityArgs : {},
                enhance: request.enhance ?? 'never',
                agent,
                attach: (input) => this._uploadGenerated(input, { meshId, chatId, runId, deviceId }),
                fetchAttachment: (query) => this._fetchAttachment(engine, chatId, query),
                progress: (update) => modelWatch.image(update),
                signal: controller.signal
            });
            for await (const event of events) {
                if (event.type === 'metrics') {
                    const { type, ...rest } = event;
                    metrics = rest;
                    this._log?.info('runs', 'capability metrics', { runId, capability, ...rest });
                    continue;
                }
                if (event.type === 'error' && !this._backgrounded) {
                    await transcript.status({
                        state: 'failed',
                        reason: runFailureNotice(event.message),
                        metrics
                    });
                    return;
                }
                if (event.type === 'error') {
                    this._log?.info('runs', 'background error replayed', { runId, message: event.message });
                }
                if (event.type === 'error' || event.type === 'aborted') {
                    await endAbortedCapability();
                    return;
                }
                if (isHarnessEvent(event, 'tool-call')) {
                    await transcript.chunk(toolCallChunk(event));
                }
                else if (isHarnessEvent(event, 'tool-result')) {
                    await transcript.chunk(toolResultChunk(event));
                }
                else {
                    this._log?.warn('assistant', 'unknown capability event dropped', { type: event.type });
                }
            }
            await transcript.status({ state: 'completed', metrics });
        }
        catch (err) {
            const outcome = controller.signal.aborted
                ? this._abortOutcome(runId, controller.signal.reason)
                : null;
            if (outcome?.kind === 'replay') {
                this._seen.delete(runId);
                return;
            }
            if (outcome?.kind === 'handoff') {
                return;
            }
            await transcript.status({
                state: 'failed',
                reason: outcome?.reason ?? runFailureNotice(err),
                metrics
            });
        }
        finally {
            transcript.close();
            modelWatch.stop();
            settledWatch.stop();
            ownershipWatch.stop();
        }
    }
    async _loadToolConfigs(engine, agentId) {
        const { configs } = await engine.listToolConfigs({ agentId }).catch((err) => {
            this._log?.warn('assistant', 'tool configs read failed', err);
            return { configs: [] };
        });
        const map = {};
        for (const row of configs ?? []) {
            if (row?.toolName && isRecord(row.settings)) {
                map[row.toolName] = row.settings;
            }
        }
        return map;
    }
    async _loadFsGrants(agentId) {
        const [roots, write] = await Promise.all([
            this._readRootGrants(fsGrantKey(agentId)),
            this._readWriteGrants(fsWriteGrantKey(agentId))
        ]);
        return { roots, write };
    }
    async _readRootGrants(key) {
        const { value } = await this._engine.configGet({ key }).catch((err) => {
            this._log?.warn('assistant', 'fs grants read failed', { key, err });
            return { value: null };
        });
        return fsGrantsFrom(value);
    }
    async _readWriteGrants(key) {
        const { value } = await this._engine.configGet({ key }).catch((err) => {
            this._log?.warn('assistant', 'fs write grants read failed', { key, err });
            return { value: null };
        });
        return grantedDirsFrom(value);
    }
    async _fetchAttachment(engine, chatId, { attachmentId, kind = 'image', signal, meta } = {}) {
        if (!attachmentId) {
            const { chunks } = await raceAbort(engine.listChunks({ chatId, type: 'attachment' }), signal);
            attachmentId = (chunks ?? [])
                .map((chunk) => chunk.attachment)
                .filter((file) => {
                if (!file || file.deletedAt)
                    return false;
                return kind === 'audio'
                    ? isAudioAttachment(file.fileName, file.mimeType)
                    : IMAGE_MIMES.has(file.mimeType.toLowerCase());
            })
                .at(-1)?.id;
        }
        if (!attachmentId) {
            return null;
        }
        const stream = engine.fileRead({ chatId, fileId: attachmentId, metadataOnly: meta });
        const abort = () => stream.destroy();
        const pieces = [];
        let head = null;
        stream.on('error', noop);
        signal?.addEventListener('abort', abort, { once: true });
        try {
            if (signal?.aborted) {
                throw new AbortedError();
            }
            for await (const frame of stream) {
                if (frame.metadata) {
                    const { id, fileName, mimeType, byteLength } = frame.metadata;
                    head = { id, fileName, mimeType, byteLength };
                }
                if (frame.data) {
                    pieces.push(frame.data);
                }
            }
            if (signal?.aborted) {
                throw new AbortedError();
            }
            return head && (meta ? head : { ...head, bytes: b4a.concat(pieces) });
        }
        finally {
            signal?.removeEventListener('abort', abort);
            stream.destroy();
        }
    }
    async _readBlob(url, signal) {
        if (!url || signal?.aborted)
            return null;
        const pending = defaultFetch(url).catch(noop);
        try {
            const response = await raceInactivity(pending, signal, this._blobReadTimeoutMs);
            const bytes = response?.ok
                ? await drainBody(response.body, signal, this._blobReadTimeoutMs)
                : null;
            return bytes?.length ? bytes : null;
        }
        catch {
            pending.then((response) => response?.body?.cancel(), noop);
            return null;
        }
    }
    async _uploadGenerated({ fileName, mimeType, bytes, raw }, { meshId, chatId, runId, deviceId, sourceId }) {
        const duplex = this._engine.uploadAttachment();
        duplex.write({
            chatId,
            runId,
            originDeviceId: deviceId,
            fileName,
            mimeType,
            raw,
            meshId,
            sourceId
        });
        const buf = b4a.toBuffer(bytes);
        for (let i = 0; i < buf.length; i += UPLOAD_FRAME_BYTES) {
            duplex.write({ data: buf.subarray(i, i + UPLOAD_FRAME_BYTES) });
        }
        duplex.end();
        let attachment = null;
        for await (const frame of duplex) {
            if (frame.attachment) {
                attachment = frame.attachment;
            }
        }
        if (!attachment) {
            throw new Error('attachment upload ended without a record');
        }
        return attachment;
    }
    async _hydrateAudio(messages, signal) {
        const turns = messages.filter((turn) => turn.audioAttachments?.length);
        if (!turns.length) {
            return;
        }
        for (const turn of turns) {
            for (const ref of turn.audioAttachments ?? []) {
                if (signal.aborted)
                    return;
                const block = await this._transcribeAttachment(ref, signal);
                turn.content = turn.content.trim() ? `${turn.content}\n\n${block}` : block;
            }
            delete turn.audioAttachments;
        }
    }
    async _transcribeAttachment(ref, signal) {
        const label = `Attached audio "${ref.fileName}"`;
        const cached = this._audioTranscripts.get(ref.blobId);
        if (cached !== undefined) {
            return cached ? audioTranscriptBlock(ref.fileName, cached) : silentAudioNotice(ref.fileName);
        }
        if (!this._harness.transcribe) {
            return unheardAudioNotice(label, 'transcription is unavailable on this device', {
                retryable: false
            });
        }
        try {
            const bytes = await this._readBlob(ref.url, signal);
            if (!bytes) {
                return unheardAudioNotice(label, 'its content has not reached this device — the upload may still be syncing');
            }
            const model = mediaModelNameFor('transcription', await this._persistedProfile());
            await this.ensureMediaModelUnpaused('transcription', model);
            await this._downloads?.waitUntilCached(model, signal);
            const text = (await this._harness.transcribe({ model: '', audio: b4a.toBuffer(bytes), signal })).trim();
            this._audioTranscripts.set(ref.blobId, text);
            if (!text) {
                return silentAudioNotice(ref.fileName);
            }
            return audioTranscriptBlock(ref.fileName, text);
        }
        catch (err) {
            if (signal.aborted) {
                throw err;
            }
            this._log?.warn('assistant', `audio transcription failed — ${ref.fileName}`, err);
            return unheardAudioNotice(label, 'transcription failed on this device');
        }
    }
    async _seesImages(model) {
        if (this._harness.supportsImagesFor) {
            return this._harness.supportsImagesFor(model);
        }
        const anyModel = (this._harness.supportsImages ?? this._info.supportsImages) !== false;
        if (!anyModel || !this._harness.list) {
            return anyModel;
        }
        const rows = await this._harness.list({ type: 'llm' }).catch(noop);
        if (!rows) {
            return anyModel;
        }
        const row = rows.find((candidate) => candidate.name === model);
        return row ? (row.supportsImages ?? anyModel) : false;
    }
    async _hydrateVideos(messages, run) {
        const { signal, runId, seesImages, reading, sampled } = run;
        const turns = messages.filter((turn) => turn.videos?.length);
        if (!turns.length) {
            return;
        }
        const asked = messages.findLast((turn) => turn.role === 'user')?.videos ?? [];
        const dir = this._imageCacheDir;
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
        const pinned = this._runImageCacheNames.get(runId) ?? new Set();
        this._runImageCacheNames.set(runId, pinned);
        const unsampled = turns.flatMap((turn) => turn.videos ?? []).filter((ref) => !ref.digest);
        const budget = { ...reading, videos: unsampled.length };
        for (const turn of turns) {
            for (const ref of turn.videos ?? []) {
                if (signal.aborted)
                    return;
                const hydration = { dir, ref, pinned, seesImages, signal, budget, sampled };
                const blocks = await this._hydrateVideo(turn, hydration);
                turn.content = [turn.content.trim(), ...blocks].filter(Boolean).join('\n\n');
            }
            delete turn.videos;
        }
        const pictured = asked.some((ref) => ref.digest || this._videoProbes.get(ref.blobId)?.hasVideo);
        if (!seesImages && pictured) {
            throw new Error(RUN_FAILURE_REASONS.videoNeedsVision);
        }
    }
    async _hydrateVideo(turn, hydration) {
        const { ref, seesImages, signal } = hydration;
        const source = { opened: null };
        const open = () => (source.opened ??= this._openVideo(hydration));
        try {
            const video = await this._readVideo(hydration, open);
            if (video === 'unsynced') {
                return [unsyncedVideoNotice(ref.fileName)];
            }
            if (video === 'audio') {
                return [await this._transcribeAttachment(ref, signal)];
            }
            if (!seesImages || !('files' in video)) {
                return [hiddenVideoNotice(ref.fileName), videoAudioBlock(ref.fileName, video)];
            }
            attachPages(turn, video.files);
            const annotation = videoAnnotation({
                fileName: ref.fileName,
                duration: video.duration,
                times: video.times
            });
            return [annotation, videoAudioBlock(ref.fileName, video)];
        }
        catch (err) {
            if (signal.aborted) {
                throw err;
            }
            this._log?.warn('assistant', `video hydration failed — ${ref.fileName}`, err);
            return [unreadVideoNotice(ref.fileName)];
        }
        finally {
            const video = await source.opened?.catch(noop);
            if (video) {
                await fs.promises.unlink(video.file).catch(noop);
            }
        }
    }
    async _readVideo(hydration, open) {
        const { ref, seesImages, signal } = hydration;
        const stored = ref.digest ? await this._storedVideo(ref.digest, hydration) : null;
        if (stored) {
            return stored;
        }
        const probe = await this._probeVideo(ref, open);
        if (!probe) {
            return 'unsynced';
        }
        if (!probe.hasVideo) {
            return 'audio';
        }
        if (!seesImages) {
            return probe.hasAudio ? this._hearVideo(ref, open, signal) : { audio: 'none' };
        }
        const video = await open();
        if (!video) {
            return 'unsynced';
        }
        return this._sampleVideo(video, probe, hydration);
    }
    async _probeVideo(ref, open) {
        const known = this._videoProbes.get(ref.blobId);
        if (known) {
            return known;
        }
        const video = await open();
        if (!video) {
            return null;
        }
        const probe = await probeVideo(video.file);
        this._videoProbes.set(ref.blobId, probe);
        return probe;
    }
    async _storedVideo(digest, { dir, ref, pinned, signal }) {
        const headerName = videoHeaderCacheName(digest.blobId);
        pinned.add(headerName);
        const header = await fs.promises
            .readFile(path.join(dir, headerName), 'utf8')
            .then(parseVideoDigestHeader, noop);
        if (header) {
            const files = header.times.map((_, i) => {
                const name = videoFrameCacheName(ref, header.times.length, i);
                pinned.add(name);
                this._mediaRefs.set(name, { id: ref.id, frame: i, frames: header.times.length });
                return path.join(dir, name);
            });
            const cached = await Promise.all(files.map((file) => cacheOrTouch(file, noBytes)));
            if (cached.every(Boolean)) {
                return { ...header, files };
            }
        }
        const bytes = await this._readBlob(digest.url, signal);
        if (!bytes) {
            return null;
        }
        const target = { dir, pinned, digestBlobId: digest.blobId };
        try {
            return await this._cacheVideo(ref, unpackVideoDigest(bytes), target);
        }
        catch (err) {
            this._log?.warn('assistant', `video digest unreadable — ${ref.fileName}`, err);
            return null;
        }
    }
    async _cacheVideo(ref, digest, { dir, pinned, digestBlobId }) {
        const { frames, ...header } = digest;
        const files = frames.map((_, i) => {
            const name = videoFrameCacheName(ref, frames.length, i);
            pinned.add(name);
            this._mediaRefs.set(name, { id: ref.id, frame: i, frames: frames.length });
            return path.join(dir, name);
        });
        await Promise.all(frames.map((frame, i) => cacheOrTouch(files[i], () => Promise.resolve(frame))));
        if (digestBlobId) {
            const headerName = videoHeaderCacheName(digestBlobId);
            pinned.add(headerName);
            await cacheOrTouch(path.join(dir, headerName), () => Promise.resolve(b4a.from(JSON.stringify(header))));
        }
        return { ...header, files };
    }
    async _sampleVideo(video, probe, hydration) {
        const { ref, budget, signal } = hydration;
        const started = Date.now();
        const count = videoFrameCount(probe, budget);
        const times = frameTimes(probe.duration, count);
        const frames = await sampleFrames(video.file, { times, maxEdge: VIDEO_FRAME_EDGE, probe });
        const sampleMs = Date.now() - started;
        const heard = probe.hasAudio
            ? await this._hearVideo(ref, () => Promise.resolve(video), signal)
            : { audio: 'none' };
        const digest = {
            duration: probe.duration,
            times: frames.map((frame) => frame.time),
            ...heard,
            frames: frames.map((frame) => frame.jpeg)
        };
        if (!hydration.ref.digest) {
            hydration.sampled.push({ ref, digest });
        }
        this._log?.info('assistant', 'video frames', {
            fileName: ref.fileName,
            duration: probe.duration,
            frames: frames.length,
            budget: count,
            ctxSize: budget.ctxSize ?? null,
            cacheTokens: budget.cacheTokens ?? null,
            audio: heard.audio,
            sampleMs
        });
        return this._cacheVideo(ref, digest, hydration);
    }
    async _storeVideoDigests(sampled, target) {
        const dir = this._imageCacheDir;
        const pinned = this._runImageCacheNames.get(target.runId) ?? new Set();
        for (const { ref, digest } of sampled) {
            try {
                const blobId = await this._uploadVideoDigest(ref, digest, target);
                await this._cacheVideo(ref, digest, { dir, pinned, digestBlobId: blobId });
            }
            catch (err) {
                this._log?.warn('assistant', `video digest not stored — ${ref.fileName}`, err);
            }
        }
    }
    async _uploadVideoDigest(ref, digest, target) {
        const attachment = await this._uploadGenerated({
            fileName: videoDigestFileName(ref.fileName),
            mimeType: VIDEO_DIGEST_MIME,
            bytes: packVideoDigest(digest),
            raw: true
        }, { ...target, sourceId: ref.id });
        return attachment.blobId;
    }
    async _openVideo({ dir, ref, pinned, signal }) {
        const bytes = await this._readBlob(ref.url, signal);
        if (!bytes) {
            return null;
        }
        const name = `${imageCacheName(ref)}.source`;
        pinned.add(name);
        const file = path.join(dir, name);
        await fs.promises.writeFile(file, bytes, { mode: 0o600 });
        return { bytes, file };
    }
    async _hearVideo(ref, open, signal) {
        const cached = this._audioTranscripts.get(ref.blobId);
        if (cached !== undefined) {
            return cached ? { audio: 'speech', transcript: cached } : { audio: 'silent' };
        }
        if (!this._harness.transcribe) {
            return { audio: 'unheard' };
        }
        try {
            const video = await open();
            if (!video) {
                return { audio: 'unheard' };
            }
            const model = mediaModelNameFor('transcription', await this._persistedProfile());
            await this.ensureMediaModelUnpaused('transcription', model);
            await this._downloads?.waitUntilCached(model, signal);
            const transcript = (await this._harness.transcribe({ model: '', audio: b4a.toBuffer(video.bytes), signal })).trim();
            this._audioTranscripts.set(ref.blobId, transcript);
            return transcript ? { audio: 'speech', transcript } : { audio: 'silent' };
        }
        catch (err) {
            if (signal.aborted) {
                throw err;
            }
            this._log?.warn('assistant', `video transcription failed — ${ref.fileName}`, err);
            return { audio: 'unheard' };
        }
    }
    async _hydrateImages(messages, signal, runId) {
        const unreadable = new Map();
        const turns = messages.filter((turn) => turn.images?.length);
        if (!turns.length) {
            return unreadable;
        }
        const inUse = new Set(turns.flatMap((turn) => (turn.images ?? []).map(imageCacheName)));
        this._runImageCacheNames.set(runId, inUse);
        const dir = this._imageCacheDir;
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
        for (const turn of turns) {
            const dropped = await this._hydrateTurnImages(turn, { dir, signal });
            if (dropped.length) {
                unreadable.set(turn, dropped);
            }
            delete turn.images;
        }
        return unreadable;
    }
    async _hydrateTurnImages(turn, { dir, signal }) {
        const dropped = [];
        for (const image of turn.images ?? []) {
            try {
                const file = await this._hydrateImage(dir, image, signal);
                turn.attachments = [...(turn.attachments ?? []), { path: file }];
            }
            catch (err) {
                if (signal.aborted) {
                    throw err;
                }
                this._log?.error('assistant', `image hydration failed — skipped ${image.fileName}`, err);
                dropped.push(image.fileName);
            }
        }
        return dropped;
    }
    async _servedMedia(sources, { id, modelId, signal }) {
        if (!(await this._seesImages(modelId))) {
            return sources.map(() => null);
        }
        const dir = this._imageCacheDir;
        const pinned = new Set();
        this._runImageCacheNames.set(`round:${id}`, pinned);
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
        const docs = new Map();
        try {
            const files = [];
            for (const source of sources) {
                files.push(await this._servedFile(source, { dir, pinned, docs, signal }).catch(() => null));
            }
            return files;
        }
        finally {
            for (const doc of docs.values()) {
                void doc.then((open) => open?.close(), noop);
            }
        }
    }
    _servedFile(source, served) {
        const { ref, attachment } = source;
        if (ref.frame !== undefined && ref.frames) {
            return this._servedFrame(source, { frame: ref.frame, frames: ref.frames }, served);
        }
        if (ref.page !== undefined) {
            return this._servedPage(attachment, ref.page, served);
        }
        served.pinned.add(imageCacheName(attachment));
        return this._hydrateImage(served.dir, attachment, served.signal);
    }
    async _servedFrame({ attachment, digest }, { frame, frames }, { dir, pinned, signal }) {
        const file = path.join(dir, videoFrameCacheName(attachment, frames, frame));
        pinned.add(path.basename(file));
        if (await cacheOrTouch(file, noBytes)) {
            return file;
        }
        const bytes = digest ? await this._readBlob(digest.url, signal) : null;
        const video = bytes && unpackVideoDigest(bytes);
        if (!digest || !video || video.frames.length !== frames) {
            return null;
        }
        const target = { dir, pinned, digestBlobId: digest.blobId };
        return (await this._cacheVideo(attachment, video, target)).files[frame] ?? null;
    }
    async _servedPage(pdf, page, { dir, pinned, docs, signal }) {
        const name = pdfPageCacheName(pdf, page);
        pinned.add(name);
        const file = path.join(dir, name);
        const rendered = await cacheOrTouch(file, async () => {
            let doc = docs.get(pdf.id);
            if (!doc) {
                doc = this._readBlob(pdf.url, signal).then((bytes) => bytes ? this._pdfRasterizer.open(bytes) : null);
                docs.set(pdf.id, doc);
            }
            return (await doc)?.renderPage(page) ?? null;
        });
        return rendered ? file : null;
    }
    async _hydrateImage(dir, image, signal) {
        const file = path.join(dir, imageCacheName(image));
        this._mediaRefs.set(imageCacheName(image), { id: image.id });
        await cacheOrTouch(file, async () => {
            const raw = await this._readBlob(image.url, signal);
            if (signal.aborted) {
                throw new Error('hydration aborted');
            }
            if (!raw) {
                throw new Error(`empty download for ${image.fileName}`);
            }
            return normalizeImageForModel(raw);
        });
        return file;
    }
    async _hydratePdfPages(messages, { signal, runId, window }) {
        const rendered = new Set();
        const cuts = [];
        const turns = messages.filter((turn) => turn.pdfs?.length);
        if (!turns.length) {
            return { rendered, cuts };
        }
        const dir = this._imageCacheDir;
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
        const pinned = this._runImageCacheNames.get(runId) ?? new Set();
        this._runImageCacheNames.set(runId, pinned);
        const latestUser = messages.findLast((turn) => turn.role === 'user');
        const maxPages = await this._pdfPageBudget(window);
        for (const turn of turns) {
            const { shown, notices } = await this._hydrateTurnPdfs(turn, {
                dir,
                pinned,
                signal,
                maxPages
            });
            if (turn === latestUser) {
                for (const id of shown) {
                    rendered.add(id);
                }
            }
            cuts.push(...notices.map((notice) => ({ turn, notice })));
        }
        return { rendered, cuts };
    }
    async _pdfPageBudget({ ctxSize, modelName }) {
        const custom = await this._customModel(modelName);
        const window = effectiveCtxSize({ ctxSize, modelName }, { appCtxSize: 0, platform: this._platform, custom });
        return pdfPageBudget(window);
    }
    async _customModel(name) {
        for await (const list of this._engine.customModelsWatch({})) {
            return list.models?.find((row) => row.name === name) ?? null;
        }
        return null;
    }
    async _hydrateTurnPdfs(turn, { dir, pinned, signal, maxPages }) {
        const shown = [];
        const notices = [];
        let budget = maxPages;
        for (const pdf of turn.pdfs ?? []) {
            if (budget <= 0) {
                notices.push(pdfPagesSkippedNotice(pdf.fileName));
                continue;
            }
            const pages = await this._tryHydratePdf(dir, turn, { pdf, pinned, maxPages: budget, signal });
            budget -= pages.tried;
            if (pages.names.length) {
                shown.push(pdf.id);
            }
            if (pages.cut) {
                notices.push(pdfPagesCutNotice({ fileName: pdf.fileName, ...pages.cut }));
            }
        }
        delete turn.pdfs;
        return { shown, notices };
    }
    async _tryHydratePdf(dir, turn, opts) {
        try {
            return await this._hydratePdf(dir, turn, opts);
        }
        catch (err) {
            if (opts.signal.aborted) {
                throw err;
            }
            this._log?.warn('assistant', `pdf rasterization failed — ${opts.pdf.fileName}`, err);
            return { names: [], tried: 0 };
        }
    }
    async _hydratePdf(dir, turn, { pdf, pinned, maxPages, signal }) {
        const key = `${pdf.blobId}:${maxPages}`;
        const memo = this._pdfPages.get(key);
        if (memo) {
            for (const name of memo.names) {
                pinned.add(name);
            }
            const files = memo.names.map((name) => path.join(dir, name));
            if ((await Promise.all(files.map((file) => cacheOrTouch(file, noBytes)))).every(Boolean)) {
                attachPages(turn, files);
                return memo;
            }
        }
        const pages = await this._renderPdf(dir, { pdf, pinned, maxPages, signal });
        if (!pages) {
            return { names: [], tried: 0 };
        }
        this._pdfPages.set(key, pages);
        attachPages(turn, pages.names.map((name) => path.join(dir, name)));
        return pages;
    }
    async _renderPdf(dir, { pdf, pinned, maxPages, signal }) {
        const bytes = await this._readBlob(pdf.url, signal);
        if (signal.aborted) {
            throw new Error('hydration aborted');
        }
        if (!bytes) {
            return null;
        }
        const doc = await this._pdfRasterizer.open(bytes);
        if (!doc) {
            return { names: [], tried: 0 };
        }
        try {
            const names = [];
            let tried = 0;
            let page = 0;
            const pageCount = doc.pageCount();
            for (; page < pageCount && tried < maxPages; page++) {
                if (signal.aborted)
                    throw new Error('hydration aborted');
                const outcome = await this._renderPdfPage(doc, { dir, pdf, page, pinned, signal });
                if (outcome.tried) {
                    tried++;
                }
                if (outcome.name) {
                    names.push(outcome.name);
                }
            }
            return { names, tried, cut: pdfCut(doc, page) };
        }
        finally {
            doc.close();
        }
    }
    async _renderPdfPage(doc, { dir, pdf, page, pinned, signal }) {
        let tried = false;
        try {
            const flags = doc.pageFlags(page);
            if (flags.hasText && !flags.hasImage) {
                return { tried };
            }
            tried = true;
            const name = pdfPageCacheName(pdf, page);
            pinned.add(name);
            this._mediaRefs.set(name, { id: pdf.id, page });
            const cached = await cacheOrTouch(path.join(dir, name), () => doc.renderPage(page));
            return { tried, name: cached ? name : undefined };
        }
        catch (err) {
            if (signal.aborted) {
                throw err;
            }
            this._log?.warn('assistant', `pdf page skipped — ${pdf.fileName} p${page}`, err);
            return { tried };
        }
    }
    async _compactIfNearFull(params) {
        const { chatId, transcript, trigger, signal, meshId, run, rounds } = params;
        const metrics = await this._lastRunMetrics(chatId, meshId);
        if (!nearContextLimit(metrics.cacheTokens, metrics.ctxSize)) {
            return false;
        }
        if (!canCompact(metrics.ctxSize)) {
            this._log?.debug('runs', 'chat near its window but under the compaction floor', {
                chatId,
                ctxSize: metrics.ctxSize
            });
            return false;
        }
        return this._runCompaction({
            chatId,
            transcript,
            trigger,
            signal,
            occupancy: metrics,
            meshId,
            run,
            rounds
        });
    }
    async _runCompaction(params) {
        const { chatId, transcript, trigger, signal, meshId, run, rounds } = params;
        let statusId = null;
        const started = Date.now();
        try {
            const result = await this.compactChat(chatId, {
                onFold: async () => {
                    const status = await transcript.status({
                        state: 'executing',
                        progress: { phase: 'compacting' }
                    });
                    statusId = status.id;
                },
                meshId,
                signal,
                run,
                rounds
            });
            this._log?.info('runs', 'compaction', {
                chatId,
                trigger,
                compacted: result.compacted,
                reason: result.reason ?? null,
                foldedTurns: result.foldedTurns ?? 0,
                cacheTokens: params.occupancy?.cacheTokens ?? null,
                ctxSize: params.occupancy?.ctxSize ?? null,
                announced: statusId !== null,
                ms: Date.now() - started
            });
            return result.compacted;
        }
        catch (err) {
            this._log?.warn('runs', 'compaction failed', { chatId, trigger, err });
            return false;
        }
        finally {
            if (trigger === 'before-run' && statusId) {
                await transcript.progress(statusId, { state: 'executing' }).catch(noop);
            }
        }
    }
    async _contextReading({ chatId, meshId, folded }, ctxSize) {
        const last = folded ? {} : await this._lastRunMetrics(chatId, meshId);
        const window = ctxSize || last.ctxSize;
        if (!window) {
            return {};
        }
        return last.ctxSize === window
            ? { ctxSize: window, cacheTokens: last.cacheTokens }
            : { ctxSize: window };
    }
    async _lastRunMetrics(chatId, meshId) {
        const deviceId = this._requireDeviceId();
        const { chunks } = await meshScoped(this._engine, meshId)
            .listChunks({ chatId, type: 'run-status' })
            .catch(() => ({ chunks: [] }));
        const statuses = chunks ?? [];
        for (let index = statuses.length - 1; index >= 0; index--) {
            const chunk = statuses[index];
            const metrics = chunk.runStatus?.metrics;
            if (chunk.runStatus?.state !== 'completed' || !metrics) {
                continue;
            }
            if (!chunk.originDeviceId || !b4a.equals(chunk.originDeviceId, deviceId)) {
                return {};
            }
            const parsed = RunOccupancySchema.safeParse(metrics);
            if (!parsed.success) {
                return {};
            }
            return { cacheTokens: parsed.data.cacheTokens, ctxSize: parsed.data.ctxSize };
        }
        return {};
    }
    async compactChat(chatId, options) {
        if (!this.opened)
            await this.ready();
        const engine = meshScoped(this._engine, options.meshId);
        const deviceId = this._requireDeviceId();
        const chat = await engine.getChat({ chatId }).catch(noop);
        if (!chat) {
            return { compacted: false, reason: 'unknown chat' };
        }
        const agent = await engine.getAgent({ agentId: chat.agentId }).catch(noop);
        if (!agent || !(options.run || b4a.equals(agent.providerDeviceId, deviceId))) {
            return { compacted: false, reason: 'not the provider device' };
        }
        const model = runnableModelName(agent.modelName, await this._runnableHost());
        const config = await engine.getConfig({}).catch(noop);
        const ctxSize = agent.ctxSize || config?.ctxSize || undefined;
        if (ctxSize !== undefined && !canCompact(ctxSize)) {
            return { compacted: false, reason: 'below-floor' };
        }
        const all = await listHistoryChunks(engine, chatId);
        const stored = options.run ? foldableView(all, options.run) : all;
        const branches = historyBranches(stored);
        const chunks = stored.filter((chunk) => isPromptChunk(chunk, branches));
        const { chunks: priorAsks } = await engine
            .listChunks({ chatId, type: 'approval-request' })
            .catch(() => ({ chunks: [] }));
        const lastThroughId = lastCompactedThroughId(chunks);
        const lastThroughSeq = all.find((chunk) => chunk.id === lastThroughId)?.seq ?? -1;
        const userTurns = chunks.filter((chunk) => chunk.userMessage).length;
        let announced = false;
        let keepTurns = COMPACTION_KEEP_TURNS;
        for (;;) {
            const boundary = compactionBoundary(chunks, keepTurns);
            if (!boundary) {
                return { compacted: false, reason: 'nothing-to-fold' };
            }
            const through = chunks.find((chunk) => chunk.id === boundary.throughId);
            if (!through) {
                return { compacted: false, reason: 'nothing-to-fold' };
            }
            if (through.seq <= lastThroughSeq) {
                return { compacted: false, reason: 'already-compacted' };
            }
            const inRange = chunks.filter((chunk) => chunk.seq <= through.seq);
            const folded = historyFromChunks(inRange, staleToolRunIds(inRange, priorAsks ?? [], ''));
            if (!announced) {
                await options.onFold?.();
                announced = true;
            }
            const attempt = await this._summarize(folded, {
                model,
                agent: withConfigDefaults(agent, config),
                signal: options.signal,
                rounds: options.rounds
            });
            if (!attempt.summary) {
                if (attempt.overflowed && boundary.foldedTurns > 1) {
                    keepTurns = userTurns - Math.floor(boundary.foldedTurns / 2);
                    continue;
                }
                return { compacted: false, reason: 'the model produced no summary' };
            }
            const summary = attempt.summary;
            if (!foldReducesPrompt(folded, summary)) {
                return { compacted: false, reason: 'summary-not-smaller' };
            }
            if (options.signal?.aborted) {
                return { compacted: false, reason: 'canceled' };
            }
            await engine.appendChunk({
                chatId,
                type: 'compaction',
                compaction: { summary, throughId: boundary.throughId },
                originDeviceId: deviceId
            });
            await this._deleteChatKvCache(chatId, 'compaction');
            this._log?.info('runs', 'chat compacted', {
                chatId,
                foldedTurns: boundary.foldedTurns,
                summaryChars: summary.length
            });
            return { compacted: true, foldedTurns: boundary.foldedTurns };
        }
    }
    async _summarize(turns, { model, agent, signal, rounds }) {
        const hasPriorSummary = turns[0]?.content.startsWith(COMPACTION_TURN_PREFIX) === true;
        const prompt = buildCompactionPrompt(nameSenders(turns).map((turn) => ({ role: turn.role, content: turn.content })), hasPriorSummary);
        const round = this._probeRounds(rounds);
        if (round) {
            return this._summarizeInRound(round, { prompt, model, signal });
        }
        const events = this._harness.completion({
            model,
            agent: {
                ...agent,
                toolsScope: 'selected',
                enabledTools: [],
                skillsScope: 'selected',
                enabledSkills: []
            },
            messages: [{ role: 'user', content: prompt }],
            generationParams: { reasoning_budget: 0 },
            signal: signal ?? this._lifecycle.signal
        });
        let text = '';
        let failed = null;
        for await (const event of events) {
            if (event.type === 'content' && typeof event.text === 'string') {
                text += event.text;
            }
            else if (event.type === 'error') {
                failed = typeof event.message === 'string' ? event.message : 'summarizer failed';
                break;
            }
            else if (event.type === 'aborted') {
                failed = 'summarizer aborted';
                break;
            }
            else if (event.type === 'done') {
                break;
            }
        }
        if (failed !== null) {
            this._log?.warn('runs', 'summarizer failed mid-stream', { chars: text.length, failed });
            return { summary: null, overflowed: isContextOverflowFailure(failed) };
        }
        return { summary: parseCompactionSummary(text), overflowed: false };
    }
    async _summarizeInRound(rounds, { prompt, model, signal }) {
        try {
            const text = await rounds.probe({
                kind: 'fold',
                prompt,
                modelId: model,
                signal: signal ?? this._lifecycle.signal
            });
            return { summary: parseCompactionSummary(text), overflowed: false };
        }
        catch (err) {
            const failed = errorMessage(err);
            this._log?.warn('runs', 'summarizer round failed', { failed });
            return { summary: null, overflowed: isContextOverflowFailure(failed) };
        }
    }
    async _autoTitle(engine, { chatId, messages, model, agent, probe, rounds }) {
        try {
            const first = messages.find((turn) => turn.role === 'user' && turn.content.trim());
            if (!first) {
                return;
            }
            const chat = await engine.getChat({ chatId });
            if (!isDefaultChatTitle(chat?.title)) {
                return;
            }
            await this._generateChatTitle({
                engine,
                chatId,
                input: first.content,
                model,
                agent,
                probe,
                rounds
            });
        }
        catch (err) {
            this._log?.warn('runs', 'auto-title skipped', { chatId, err });
        }
    }
    _probeRounds(rounds) {
        return this._roundHost ? rounds : undefined;
    }
    async _suggestNext(engine, { chatId, runId, messages, answer, model, agent, rounds }) {
        const question = messages.findLast((turn) => turn.role === 'user' && turn.content.trim());
        if (!question || this.closing || !(await this._suggestingPrompts())) {
            return;
        }
        const { chunks } = await engine.listChunks({ chatId, type: 'run-request' });
        if ((chunks ?? []).at(-1)?.runId !== runId) {
            return;
        }
        const controller = new AbortController();
        this._suggesting.get(chatId)?.abort(SUGGESTION_SUPERSEDED);
        this._suggesting.set(chatId, controller);
        try {
            const raw = await this._probeCompletion({
                chatId,
                input: buildSuggestionPrompt(question.content, answer),
                model,
                agent,
                signal: controller.signal,
                rounds
            }, SUGGESTION_PROBE);
            const text = parseSuggestionResponse(raw);
            if (text && !controller.signal.aborted) {
                await engine.setChatSuggestion({ chatId, suggestion: { text, runId } });
            }
        }
        catch (err) {
            this._log?.warn('runs', 'next-message suggestion skipped', { chatId, err });
        }
        finally {
            if (this._suggesting.get(chatId) === controller) {
                this._suggesting.delete(chatId);
            }
        }
    }
    async _suggestingPrompts() {
        try {
            const { value } = await this._engine.configGet({ key: SUGGEST_PROMPTS_KEY });
            return value === SUGGEST_PROMPTS_ON;
        }
        catch (err) {
            this._log?.warn('assistant', 'suggestion setting unreadable', { err });
            return false;
        }
    }
    async _generateChatTitle(params) {
        const { engine, chatId, input, model, agent, probe, rounds } = params;
        const prompt = input.trim();
        if (!prompt) {
            return null;
        }
        let generated = null;
        if (probe && !this.closing) {
            try {
                generated = await this._titleFromCompletion({
                    chatId,
                    input: prompt,
                    model,
                    agent,
                    signal: this._lifecycle.signal,
                    rounds
                });
            }
            catch (err) {
                this._log?.warn('runs', 'title completion failed', { chatId, err });
            }
        }
        const title = generated ?? deriveChatTitle(prompt);
        if (!title) {
            return null;
        }
        await engine.renameChat({ chatId, config: { title } });
        this._log?.info('runs', 'chat titled', {
            chatId,
            title,
            source: generated ? 'model' : 'heuristic'
        });
        return title;
    }
    async _titleFromCompletion(params) {
        const prompt = buildTitlePrompt(params.input);
        return parseTitleResponse(await this._probeCompletion({ ...params, input: prompt }, TITLE_PROBE));
    }
    async _probeCompletion(params, { kind, field, name, runId }) {
        const { chatId, input, model, agent, signal, rounds } = params;
        const responseFormat = {
            type: 'json_schema',
            json_schema: {
                name,
                schema: {
                    type: 'object',
                    properties: { [field]: { type: 'string' } },
                    required: [field],
                    additionalProperties: false
                }
            }
        };
        const round = this._probeRounds(rounds);
        if (round) {
            const probed = { kind, prompt: input, modelId: model, responseFormat };
            return round.probe({ ...probed, signal: signal ?? this._lifecycle.signal });
        }
        const events = this._harness.completion({
            model,
            agent: {
                ...agent,
                toolsScope: 'selected',
                enabledTools: [],
                skillsScope: 'selected',
                enabledSkills: []
            },
            messages: [{ role: 'user', content: input }],
            generationParams: { reasoning_budget: 0 },
            captureInferenceCalls: await this._capturingInferenceCalls(),
            responseFormat,
            signal
        });
        let text = '';
        for await (const event of events) {
            if (event.type === 'content' && typeof event.text === 'string') {
                text += event.text;
            }
            else if (event.type === 'inference-call') {
                void this._inferenceCalls
                    .record(chatId, { runId, at: Date.now(), call: asRecord(event.call) })
                    .catch((err) => this._log?.warn('assistant', 'probe call not recorded', { runId, err }));
            }
            else if (event.type === 'error' || event.type === 'aborted' || event.type === 'done') {
                break;
            }
        }
        return text;
    }
    _createApprove(engine, { chatId, runId, deviceId, agentId, hasRun }) {
        const waiters = new Map();
        let latestChunks = [];
        let watcher = null;
        let closing = false;
        const pump = async (source) => {
            while (true) {
                const { value, done } = await source.next();
                if (done) {
                    return;
                }
                latestChunks = value.chunks ?? [];
                for (const chunk of latestChunks) {
                    const status = chunk.approvalRequest?.status;
                    if (!status || status === 'pending') {
                        continue;
                    }
                    const waiter = waiters.get(chunk.id);
                    if (!waiter) {
                        continue;
                    }
                    waiters.delete(chunk.id);
                    this._log?.info('approvals', `answer ${status}`, {
                        runId,
                        chatId,
                        chunkId: chunk.id,
                        tool: waiter.tool
                    });
                    waiter.resolve(status === 'approved');
                }
            }
        };
        const ensureWatch = () => {
            if (watcher)
                return;
            const opened = engine
                .chunksWatch({ chatId, type: 'approval-request' })[Symbol.asyncIterator]();
            watcher = opened;
            pump(opened)
                .catch((err) => {
                if (closing) {
                    this._log?.debug('assistant', 'approval watch closed', err);
                }
                else {
                    this._log?.error('assistant', 'approval watch failed', err);
                }
            })
                .finally(() => {
                for (const [id, waiter] of waiters) {
                    this._log?.warn('approvals', 'deny: answer watch closed', {
                        runId,
                        chunkId: id,
                        tool: waiter.tool
                    });
                    waiter.resolve(false);
                }
                if (watcher === opened) {
                    watcher = null;
                }
            });
        };
        const asksForRun = async () => {
            const { chunks } = await engine
                .listChunks({ chatId, type: 'approval-request' })
                .catch(() => ({ chunks: [] }));
            return (chunks ?? []).filter((chunk) => chunk.runId === runId);
        };
        const sameCall = (chunk, call) => {
            const ask = chunk.approvalRequest;
            if (!ask || ask.name !== call.name) {
                return false;
            }
            return ((ask.resource?.kind ?? null) === (call.resource?.kind ?? null) &&
                (ask.resource?.label ?? null) === (call.resource?.label ?? null) &&
                JSON.stringify(ask.arguments) === JSON.stringify(call.arguments));
        };
        const park = (chunkId, tool) => {
            const status = latestChunks.find((c) => c.id === chunkId)?.approvalRequest?.status;
            if (status && status !== 'pending') {
                this._log?.info('approvals', `answer ${status} (raced the ask)`, { runId, chunkId, tool });
                return Promise.resolve(status === 'approved');
            }
            return new Promise((resolve) => waiters.set(chunkId, { resolve, tool }));
        };
        const approve = async (call) => {
            const { rules, ourMemberId } = await engine.listApprovalRules({}).catch((err) => {
                this._log?.warn('approvals', 'rule lookup failed, asking instead', { runId, err });
                return { rules: [], ourMemberId: undefined };
            });
            const rule = matchApprovalRule(rules ?? [], {
                toolName: call.name,
                resource: call.resource,
                agentId,
                memberId: ourMemberId
            });
            if (rule) {
                this._log?.info('approvals', `rule ${rule.decision}`, {
                    runId,
                    chatId,
                    tool: call.name,
                    resource: call.resource?.label
                });
                return rule.decision === 'allow';
            }
            ensureWatch();
            const prior = (await asksForRun()).findLast((chunk) => sameCall(chunk, call));
            if (prior) {
                const status = prior.approvalRequest?.status;
                if (!status || status === 'pending') {
                    this._log?.info('approvals', 'rebinding the ask this run parked on', {
                        runId,
                        chatId,
                        chunkId: prior.id,
                        tool: call.name
                    });
                    return park(prior.id, call.name);
                }
                if (!hasRun()) {
                    this._log?.info('approvals', `answer ${status} (from before the app closed)`, {
                        runId,
                        chatId,
                        chunkId: prior.id,
                        tool: call.name
                    });
                    return status === 'approved';
                }
                this._log?.info('approvals', 'asking again: the replay would repeat a call that ran', {
                    runId,
                    chatId,
                    priorChunkId: prior.id,
                    tool: call.name
                });
            }
            const approvalRequest = {
                status: 'pending',
                name: call.name,
                arguments: call.arguments,
                resource: call.resource ?? undefined,
                agentId
            };
            const chunk = await engine.appendChunk({
                chatId,
                runId,
                type: 'approval-request',
                approvalRequest,
                originDeviceId: deviceId,
                effect: call.effect === 'read' ? 'read' : 'write',
                intent: call.intent ?? undefined,
                display: call.display ?? undefined
            });
            this._log?.info('approvals', 'ask', {
                runId,
                chatId,
                chunkId: chunk.id,
                tool: call.name,
                resource: call.resource?.label
            });
            return park(chunk.id, call.name);
        };
        const settle = async ({ preservePending = false } = {}) => {
            if (!preservePending) {
                for (const ask of await asksForRun()) {
                    if (ask.approvalRequest?.status !== 'pending')
                        continue;
                    this._log?.warn('approvals', 'deny: unanswered at run end', {
                        runId,
                        chunkId: ask.id,
                        tool: ask.approvalRequest?.name
                    });
                    await engine.resolveApproval({ chunkId: ask.id, approved: false });
                }
                for (const waiter of waiters.values()) {
                    waiter.resolve(false);
                }
            }
            waiters.clear();
            closing = true;
            await watcher?.return?.();
            watcher = null;
        };
        return { approve, settle };
    }
    _abortOutcome(runId, reason) {
        const known = knownAbortOutcome(reason);
        if (reason === RUNNER_DIED && this._harnessDeath) {
            return { kind: 'failed', reason: this._harnessDeath };
        }
        if (known) {
            return known;
        }
        if (this._backgrounded) {
            this._backgroundReplays.add(runId);
            return { kind: 'replay' };
        }
        if (reason !== undefined) {
            this._log?.warn('runs', 'run aborted for an unrecognised reason', { runId, reason });
        }
        return { kind: 'failed', reason: RUN_FAILURE_REASONS.runtimeEndedTurn };
    }
    _watchSettled(engine, { chatId, runId, controller }) {
        const it = engine.chunksWatch({ chatId, type: 'run-status' })[Symbol.asyncIterator]();
        const watching = (async () => {
            while (true) {
                const { value, done } = await it.next();
                if (done) {
                    return;
                }
                const settled = (value.chunks ?? []).some((c) => c.runId === runId && TERMINAL_STATES.has(c.runStatus?.state ?? ''));
                if (settled) {
                    controller.abort(RUN_SETTLED);
                    return;
                }
            }
        })();
        watching.catch((err) => {
            if (this.closing || isStreamDestroyed(err))
                return;
            this._log?.error('assistant', 'settled watch failed', err);
        });
        return {
            stop: () => {
                it.return?.()?.catch?.(noop);
            }
        };
    }
    _watchOwnership(engine, { request, agentId, controller }) {
        const deviceId = this._requireDeviceId();
        const watches = [
            this._abortOnLoss(engine.agentsWatch({}), controller, ({ agents }) => {
                const row = (agents ?? []).find((a) => a.id === agentId);
                return !row || !!row.deletedAt || !drivenBy({ request, agent: row }, deviceId);
            })
        ];
        if (request.runnerDeviceId) {
            watches.push(this._abortOnLoss(engine.runRequestsWatch({}), controller, ({ chunks }) => {
                const now = (chunks ?? []).find((chunk) => chunk.id === request.id);
                return !now?.runTakenBy || !b4a.equals(now.runTakenBy, deviceId);
            }));
        }
        return {
            stop: () => watches.forEach((stop) => stop())
        };
    }
    _abortOnLoss(frames, controller, lost) {
        const it = frames[Symbol.asyncIterator]();
        const watching = (async () => {
            while (true) {
                const { value, done } = await it.next();
                if (done) {
                    return;
                }
                if (lost(value)) {
                    controller.abort(OWNERSHIP_LOST);
                    return;
                }
            }
        })();
        watching.catch((err) => {
            if (this.closing || isStreamDestroyed(err))
                return;
            this._log?.error('assistant', 'ownership watch failed', err);
        });
        return () => {
            it.return?.()?.catch?.(noop);
        };
    }
    _runsChanged() {
        this._downloads?.yieldToRuns([...this._runs.values()].filter((run) => run.executing).map((run) => run.model));
        if (this._generating()) {
            return;
        }
        for (const wake of [...this._idleWaiters]) {
            wake();
        }
    }
    _generating() {
        return [...this._runs.values()].some((run) => run.executing);
    }
    idle(signal) {
        if (signal.aborted || !this._generating()) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const wake = () => {
                this._idleWaiters.delete(wake);
                signal.removeEventListener('abort', wake);
                resolve();
            };
            this._idleWaiters.add(wake);
            signal.addEventListener('abort', wake, { once: true });
        });
    }
    _logModelStatus(state) {
        if (typeof state !== 'object' || state === null)
            return;
        if (!('status' in state) || typeof state.status !== 'string')
            return;
        if (!('model' in state) || typeof state.model !== 'string') {
            return;
        }
        const { status, model } = state;
        if (status === 'downloading' || this._modelStatusLogged.get(model) === status) {
            return;
        }
        this._modelStatusLogged.set(model, status);
        this._log?.info('models', `model ${status}`, { model });
    }
    _modelHolder(runId, chatId, model) {
        for (const [id, run] of this._runs) {
            if (id !== runId && run.executing && run.chatId !== chatId && run.model === model) {
                return run.chatId;
            }
        }
        return null;
    }
    _watchModelProgress(update, queued = false) {
        let last = '';
        let showing = queued;
        let transcribing = false;
        let documents = false;
        let sampling = false;
        const apply = (progress) => {
            const runStatus = progress
                ? { state: 'executing', progress }
                : { state: 'executing' };
            if (documents) {
                runStatus.reason = 'preparing-documents';
            }
            const key = JSON.stringify(runStatus);
            if (key === last) {
                return;
            }
            last = key;
            showing = progress !== null || documents;
            update(runStatus).catch(noop);
        };
        const onModel = (state) => {
            if (sampling)
                return;
            if (state.status === 'loading') {
                apply({ phase: 'loading', model: state.model });
            }
            else if (state.status === 'held') {
                apply({ phase: 'awaiting-download', model: state.model });
            }
            else if (state.status === 'downloading') {
                const percentage = Math.floor((state.percentage ?? 0) / 10) * 10;
                apply({ phase: 'downloading', model: state.model, percentage });
            }
            else {
                apply(transcribing ? { phase: 'transcribing' } : null);
            }
        };
        if (this._harness.on && this._harness.off) {
            this._harness.on('model', onModel);
        }
        return {
            documents: (active) => {
                documents = active;
                apply(null);
            },
            transcribe: (active) => {
                transcribing = active;
                apply(active ? { phase: 'transcribing' } : null);
            },
            image: (progress) => {
                sampling = progress !== null;
                if (!progress) {
                    return apply(null);
                }
                apply({ phase: 'generating', percentage: Math.floor(progress.percentage / 10) * 10 });
            },
            stop: () => this._harness.off?.('model', onModel),
            clear: () => {
                sampling = false;
                if (!showing) {
                    return;
                }
                showing = false;
                last = JSON.stringify({ state: 'executing' });
                update({ state: 'executing' }).catch(noop);
            }
        };
    }
}
function notReady(search) {
    return {
        chatFilesNotReady: search.chatFilesNotReady ?? 0,
        projectFilesNotReady: search.projectFilesNotReady ?? 0
    };
}
function notReadyCount(search) {
    const { chatFilesNotReady, projectFilesNotReady } = notReady(search);
    return chatFilesNotReady + projectFilesNotReady;
}
function notReadyLine(search) {
    const { projectFilesNotReady } = notReady(search);
    const chat = search.pendingFiles ?? [];
    const parts = [];
    if (chat.length) {
        parts.push(`${filesCount(chat.length, 'chat')} (${chat.join(', ')})`);
    }
    if (projectFilesNotReady) {
        parts.push(filesCount(projectFilesNotReady, 'project'));
    }
    return parts.length
        ? `[Still indexing and not used for this reply: ${parts.join(' and ')}.]`
        : null;
}
function filesCount(count, source) {
    return `${count} ${source} file${count === 1 ? '' : 's'}`;
}
async function injectRetrievedKnowledge(knowledge, { transcript, sourceTagFilter, retrievedRecords, injected }) {
    const records = sourcesFromHits(knowledge.hits, RAG_SOURCE_BOUNDS);
    const notice = chooseRagNotice({
        errorMessage: knowledge.search.errorMessage,
        hitCount: records.length,
        searchedCount: knowledge.search.searchedCount ?? 0,
        indexEmpty: Boolean(knowledge.search.indexEmpty),
        hasKnowledge: !!knowledge.search.hasKnowledge || notReadyCount(knowledge.search) > 0,
        pendingReferenced: Boolean(knowledge.search.pendingReferenced),
        failedFiles: knowledge.search.failedFiles ?? [],
        pendingFiles: knowledge.search.pendingFiles ?? []
    });
    sourceTagFilter.add(records.map((record) => record.title));
    retrievedRecords.push(...records.map((record, index) => ({
        ...record,
        excerpt: knowledge.hits[index]?.content ?? record.excerpt
    })));
    await transcript.chunk({
        type: 'sources',
        sources: { sources: records, notice: notice ?? undefined, ...notReady(knowledge.search) }
    });
    injected.sourcesWritten = true;
    if (records.length > 0) {
        knowledge.lastUser.content = `${formatRagContext(knowledge.hits, knowledge.search.availableFiles ?? [])}\n\nThe user's message:\n${knowledge.lastUser.content}\n\n${RAG_CITATION_LINE}`;
        injected.ragInjected = true;
        injected.documentsInjected = true;
    }
    else if (knowledge.search.availableFiles?.length) {
        knowledge.lastUser.content += `\n\n[Files indexed and available now: ${knowledge.search.availableFiles.join(', ')}. No relevant excerpts were retrieved for this question. Their current availability supersedes earlier indexing notices.]`;
    }
}
function noop() { }
function toolCallChunk(event) {
    return {
        type: 'tool-call',
        toolCall: { name: event.name, arguments: event.args },
        effect: event.effect === 'read' ? 'read' : 'write',
        display: event.display,
        rawCall: typeof event.rawCall === 'string' ? event.rawCall : undefined,
        ...callOf(event)
    };
}
function toolResultChunk(event) {
    return {
        type: 'tool-result',
        toolResult: { name: event.name, result: withoutDataChannel(event.result) },
        ...callOf(event)
    };
}
function roundOf(event) {
    return typeof event.round === 'number' ? event.round : undefined;
}
function callOf(event) {
    return {
        round: roundOf(event),
        callId: typeof event.callId === 'string' ? event.callId : undefined
    };
}
function replacedTypes(event) {
    const types = Array.isArray(event.replacedTypes) ? event.replacedTypes : ['content', 'thinking'];
    return types.filter((type) => type === 'content' || type === 'thinking');
}
function runMetricsSummary(metrics) {
    const { timeToFirstToken, promptTokens, promptTokensPerSecond, cacheTokens, tokensPerSecond, totalTokens, durationMs, stopReason } = metrics;
    return {
        timeToFirstToken,
        promptTokens,
        promptTokensPerSecond,
        cacheTokens,
        tokensPerSecond,
        totalTokens,
        durationMs,
        stopReason
    };
}
function asRecord(value) {
    return isRecord(value) ? { ...value } : {};
}
function isStreamDestroyed(err) {
    return isRecord(err) && err.code === 'STREAM_DESTROYED';
}
