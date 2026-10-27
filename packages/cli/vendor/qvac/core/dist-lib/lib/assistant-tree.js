import Supervisor, {} from 'bare-supervisor';
import { harnessClearKvCache, harnessListModels, harnessPreviewModelSource, harnessSkillCatalog, harnessSkillManagement, harnessDetectLanguage, harnessSpeak, harnessSpeakStream, harnessTools, harnessTranscribe, QvacAssistant } from './assistant.js';
import { Client } from './client.js';
import { readFakeModels, watchFakeModels, withFakeModels } from './assistant/fake-models.js';
import { startCustomModelPusher } from './custom-model-pusher.js';
import { startModelIdlePusher } from './model-idle-pusher.js';
import { startModelMemoryCap } from './model-memory-cap.js';
import { startDownloadsAllowedPusher } from './downloads-allowed-pusher.js';
import { duplexPair } from '@qvac/harness/transport';
export function assistantTree(opts) {
    const { core, harness, logger = null, imageCacheDir, inferenceCallsDir, runReplayDir, imageCacheMaxBytes, imageCacheMaxAgeMs, embedder, extractors, onHarness, platform, preloadCurrentAgentModel, fakeModels = false } = opts;
    const sup = new Supervisor();
    const logged = ['child-died', 'child-restarting', 'child-ready', 'gave-up', 'stall'];
    for (const event of logged) {
        sup.on(event, (payload) => logger?.warn('assistant-tree', event, { ...payload, error: payload.error?.message }));
    }
    sup.on('power', (payload) => logger?.info('assistant-tree', 'power', payload));
    let offDiagnostics = null;
    let offInferenceCalls = null;
    let offListModels = null;
    let offDeleteModel = null;
    let offClearKvCache = null;
    let offDeleteChatKvCache = null;
    let offCompactChat = null;
    let offRetryModelDownload = null;
    let offModelResidency = null;
    let offModelUsers = null;
    let offSkills = null;
    let offSkillCatalog = null;
    let offSkillManagement = null;
    let offTools = null;
    let offEmbedder = null;
    let offHarness = null;
    let offTranscribe = null;
    let offDetectLanguage = null;
    let offPreviewModelSource = null;
    let offSpeak = null;
    let offSpeakStream = null;
    let offModelCatalogWatch = null;
    let offCustomModels = null;
    let offModelIdle = null;
    let modelMemoryCap = null;
    let offModelMemory = null;
    let offDownloadsAllowed = null;
    let offFakeModels = null;
    sup.add('engine', {
        start: async () => {
            const [server, client] = duplexPair();
            await core.connect(server, { assistant: true });
            return new Client(() => client, { logger });
        }
    });
    if (typeof harness === 'function') {
        sup.add('harness', {
            deps: ['engine'],
            start: (ctx) => harness({ engine: ctx.get('engine'), onDeath: ctx.onDeath }),
            presuspend: (h) => h.presuspend?.(),
            suspend: (h) => h.suspend?.(),
            wakeup: (h) => h.wakeup?.(),
            resume: (h) => h.resume?.()
        });
    }
    else {
        sup.add('harness', { ...harness, deps: ['engine', ...(harness.deps ?? [])] });
    }
    sup.add('assistant', {
        deps: ['engine', 'harness'],
        start: async (ctx) => {
            let fakeModelsOn = fakeModels || (await readFakeModels(core.local));
            const supervised = ctx.get('harness');
            const harness = withFakeModels(supervised, { enabled: () => fakeModelsOn });
            const engine = ctx.get('engine');
            const assistant = new QvacAssistant(engine, harness, {
                logger,
                imageCacheDir,
                inferenceCallsDir,
                runReplayDir,
                imageCacheMaxBytes,
                imageCacheMaxAgeMs,
                platform,
                preloadCurrentAgentModel,
                drives: core.fsDrives ?? undefined
            });
            offDiagnostics = core.registerDiagnostics(() => assistant.diagnosticsSlice());
            offInferenceCalls = core.registerInferenceCalls({
                list: (chatId) => assistant.inferenceCalls(chatId),
                forget: (chatId) => assistant.forgetInferenceCalls(chatId)
            });
            offListModels = core.registerListModels(harnessListModels(harness));
            offDeleteModel = core.registerDeleteModel(({ name }) => assistant.deleteModel(name));
            offClearKvCache = core.registerClearKvCache(() => assistant.clearKvCache());
            offDeleteChatKvCache = core.registerDeleteChatKvCache((chatId) => assistant.deleteChatKvCache(chatId));
            offCompactChat = core.registerCompactChat((chatId, meshId) => assistant.compactChat(chatId, { meshId }));
            offModelCatalogWatch = core.registerModelCatalogWatch(() => assistant.modelCatalogWatch());
            offCustomModels = startCustomModelPusher(harness, core.local, {
                logger,
                onPushed: () => assistant.notifyModelCatalog()
            });
            offModelIdle = startModelIdlePusher(harness, core.local, logger);
            modelMemoryCap = assistant.mobileClass
                ? null
                : startModelMemoryCap(harness, core.local, {
                    logger,
                    onPushed: () => assistant.notifyModelCatalog()
                });
            offModelMemory = core.registerModelMemory(async () => (await modelMemoryCap?.summary()) ?? null);
            offDownloadsAllowed = startDownloadsAllowedPusher(harness, core.local, logger);
            offFakeModels = fakeModels
                ? null
                : watchFakeModels(core.local, {
                    initial: fakeModelsOn,
                    onChange: (enabled) => {
                        fakeModelsOn = enabled;
                        assistant.cachedModelsChanged();
                    },
                    logger
                });
            offRetryModelDownload = core.registerRetryModelDownload((name) => assistant.retryModelDownload(name));
            offModelResidency = core.registerModelResidency({
                load: (name) => assistant.loadModel(name),
                unload: (name) => assistant.unloadModel(name)
            });
            offModelUsers = core.registerModelUsers((name) => assistant.modelUsers(name));
            offSkills = core.registerSkills(async (agentId, modelName, options) => {
                await offHarness?.ready?.();
                return assistant.skills(agentId, modelName, options);
            });
            const transcribe = harnessTranscribe(harness);
            offTranscribe = core.registerTranscribe(async (request) => {
                await assistant.ensureMediaModelUnpaused('transcription', request.model);
                return transcribe(request);
            });
            offDetectLanguage = core.registerDetectLanguage(harnessDetectLanguage(harness));
            offPreviewModelSource = core.registerPreviewModelSource(harnessPreviewModelSource(harness));
            const speak = harnessSpeak(harness);
            offSpeak = core.registerSpeak(async (request) => {
                await assistant.ensureMediaModelUnpaused('tts', request.model);
                return speak(request);
            });
            const speakStream = harnessSpeakStream(harness);
            offSpeakStream = core.registerSpeakStream((text) => (async function* () {
                await assistant.ensureMediaModelUnpaused('tts');
                yield* speakStream(text);
            })());
            const skillCatalog = harnessSkillCatalog(assistant, () => offHarness?.sync?.());
            offSkillCatalog = core.registerSkillCatalog(async (agentId, modelName, options) => {
                await offHarness?.ready?.();
                return skillCatalog(agentId, modelName, options);
            });
            offSkillManagement = core.registerSkillManagement(harnessSkillManagement(harness));
            offTools = core.registerTools(harnessTools(assistant));
            const emb = embedder?.(harness);
            if (emb) {
                let ensured = false;
                const wrapped = {
                    model: emb.model,
                    embed: async (input) => {
                        if (!ensured) {
                            ensured = await assistant.ensureMediaModelUnpaused('embedding');
                        }
                        return emb.embed(input);
                    },
                    idle: (signal) => assistant.idle(signal)
                };
                offEmbedder = core.registerEmbedder(wrapped, extractors);
            }
            const off = onHarness?.(supervised, { engine });
            if (typeof off === 'function') {
                offHarness = off;
            }
            return assistant;
        },
        stop: async (assistant) => {
            offDiagnostics?.();
            offDiagnostics = null;
            offInferenceCalls?.();
            offInferenceCalls = null;
            offListModels?.();
            offListModels = null;
            offDeleteModel?.();
            offDeleteModel = null;
            offClearKvCache?.();
            offClearKvCache = null;
            offDeleteChatKvCache?.();
            offDeleteChatKvCache = null;
            offCompactChat?.();
            offCompactChat = null;
            offModelCatalogWatch?.();
            offModelCatalogWatch = null;
            await offCustomModels?.();
            offCustomModels = null;
            await offModelIdle?.();
            offModelIdle = null;
            offModelMemory?.();
            offModelMemory = null;
            await modelMemoryCap?.stop();
            modelMemoryCap = null;
            await offDownloadsAllowed?.();
            offDownloadsAllowed = null;
            await offFakeModels?.();
            offFakeModels = null;
            offRetryModelDownload?.();
            offRetryModelDownload = null;
            offModelResidency?.();
            offModelResidency = null;
            offModelUsers?.();
            offModelUsers = null;
            offSkills?.();
            offSkills = null;
            offSkillCatalog?.();
            offSkillCatalog = null;
            offSkillManagement?.();
            offSkillManagement = null;
            offTools?.();
            offTools = null;
            await offEmbedder?.();
            offEmbedder = null;
            await offHarness?.();
            offHarness = null;
            offTranscribe?.();
            offTranscribe = null;
            offDetectLanguage?.();
            offDetectLanguage = null;
            offPreviewModelSource?.();
            offPreviewModelSource = null;
            offSpeak?.();
            offSpeak = null;
            offSpeakStream?.();
            offSpeakStream = null;
            await assistant.close();
        },
        presuspend: (assistant) => assistant.presuspend(),
        suspend: (assistant) => assistant.suspend(),
        wakeup: (assistant) => assistant.wakeup(),
        resume: (assistant) => assistant.resume()
    });
    return sup;
}
export function assistantChild(opts) {
    const { harness, core = 'core', logger = null, imageCacheDir, inferenceCallsDir, runReplayDir, imageCacheMaxBytes, imageCacheMaxAgeMs, embedder, extractors, onHarness, preloadCurrentAgentModel, fakeModels, ...spec } = opts;
    return {
        ...spec,
        deps: [core],
        start(ctx) {
            const tree = assistantTree({
                core: ctx.get(core),
                harness,
                logger,
                imageCacheDir,
                inferenceCallsDir,
                runReplayDir,
                imageCacheMaxBytes,
                imageCacheMaxAgeMs,
                embedder,
                extractors,
                onHarness,
                preloadCurrentAgentModel,
                fakeModels
            });
            tree.on('gave-up', ({ error }) => ctx.onDeath(error));
            return tree;
        },
        presuspend: (tree) => tree.presuspend(),
        suspend: (tree) => tree.suspend(),
        wakeup: (tree) => tree.wakeup(),
        resume: (tree) => tree.resume()
    };
}
