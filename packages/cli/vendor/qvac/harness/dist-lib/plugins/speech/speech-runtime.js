import { errorMessage } from '../../lib/guards.js';
import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { retryMemo } from '../../lib/helpers/retry-memo.js';
import { HarnessLog } from '../../lib/log.js';
import { residentSrc } from '../../lib/models/model-catalog.js';
import { pushQueue } from '../../lib/queue.js';
import { pcmForTranscription } from './audio-resample.js';
import { defaultTts, dialogueScript, engineOf, isDialogue, loadConfig } from './speech-engine.js';
import { createVoiceLane } from './voice-lane.js';
import { speakOnce, speakStreamOnce, transcribeAudio } from './voice.js';
const TRANSCRIPTION_MODEL_LABEL = 'transcription model';
const BUSY_MESSAGE = 'the chat model is busy; try speaking again once the current reply finishes';
function voiceSdk(models) {
    return retryMemo(async () => {
        const sdk = await models.sdk();
        if (typeof globalThis.Bare !== 'undefined') {
            const [{ ttsPlugin }, { parakeetPlugin }, { registerPlugin }] = await Promise.all([
                import('@qvac/inference/tts-ggml/plugin'),
                import('@qvac/inference/parakeet-transcription/plugin'),
                import('@qvac/inference/plugin-registry')
            ]);
            for (const [name, plugin] of [
                ['tts', ttsPlugin],
                ['parakeet', parakeetPlugin]
            ]) {
                try {
                    registerPlugin(plugin);
                }
                catch (err) {
                    HarnessLog.warn('plugin registration skipped', { plugin: name, err: errorMessage(err) });
                }
            }
        }
        return sdk;
    });
}
function transcribeClip(sdk, modelId, { audio, signal }) {
    return transcribeAudio(sdk, pcmForTranscription(audio), { modelId, signal, audio });
}
export class SpeechRuntime {
    _models;
    _options;
    _loadSdk;
    _tts;
    _transcription;
    _lane = createVoiceLane();
    constructor(models, options = {}) {
        this._models = models;
        this._options = options;
        this._loadSdk = voiceSdk(models);
        this._tts = {
            addon: 'tts',
            pool: models.registerPool({
                addon: 'tts',
                modelType: 'tts-ggml',
                modelConfigFor: (modelSrc) => loadConfig(options, modelSrc),
                needsRoom: (src) => this._needsRoom(src),
                sdk: this._loadSdk
            })
        };
        this._transcription = {
            addon: 'parakeet',
            pool: models.registerPool({
                addon: 'parakeet',
                modelType: 'parakeet-transcription',
                modelConfig: { useGPU: models.transcriptionDevice !== 'cpu' },
                openclCache: true,
                label: TRANSCRIPTION_MODEL_LABEL,
                sdk: this._loadSdk
            })
        };
    }
    defaultModel(profile) {
        return defaultTts(this._options, profile);
    }
    transcribe(context) {
        return this._voiceJob(this._transcription, context, (sdk, modelId) => transcribeClip(sdk, modelId, context));
    }
    unloadIdle() {
        return this._tts.pool.evictIdle((src) => this._needsRoom(src));
    }
    speak(context) {
        const src = residentSrc(context.model, 'tts');
        const engine = engineOf(this._options, src);
        const script = isDialogue(this._options, src)
            ? dialogueScript(this._options, context.text)
            : context.text;
        return this._voiceJob(this._tts, { ...context, model: src }, (sdk, modelId) => speakOnce(sdk, script, { modelId, engine }));
    }
    async *speakStream({ model, text, signal }) {
        const src = residentSrc(model, 'tts');
        if (isDialogue(this._options, src)) {
            throw new Error('a dialogue speaks whole: MOSS-TTSD cannot stream text fragment by fragment');
        }
        const engine = engineOf(this._options, src);
        await this._makeRoom(src, signal);
        const chunks = pushQueue();
        const { held, releaseWork } = this._open(this._tts, src);
        let sdk = null;
        let modelId = null;
        const cancel = () => {
            if (sdk && modelId) {
                void sdk.cancel({ modelId, operation: 'inference' }).catch(noop);
            }
        };
        signal?.addEventListener('abort', cancel, { once: true });
        const job = (async () => {
            try {
                const loadedId = (await raceAbort(held.load(), signal)).modelId;
                modelId = loadedId;
                const voiceSdk = await this._loadSdk();
                sdk = voiceSdk;
                await this._lane(async () => {
                    if (signal?.aborted) {
                        return;
                    }
                    for await (const chunk of speakStreamOnce(voiceSdk, text, {
                        modelId: loadedId,
                        engine
                    })) {
                        chunks.push(chunk);
                    }
                });
            }
            finally {
                chunks.end();
            }
        })();
        let settled = false;
        try {
            yield* chunks;
            await job;
            settled = true;
        }
        finally {
            signal?.removeEventListener('abort', cancel);
            if (!settled) {
                cancel();
            }
            void job
                .catch(noop)
                .finally(() => {
                try {
                    held.release();
                }
                finally {
                    releaseWork();
                }
            })
                .catch(noop);
        }
    }
    _needsRoom(src) {
        return engineOf(this._options, src) === 'moss';
    }
    async _makeRoom(src, signal) {
        if (this._needsRoom(src) && !this._tts.pool.resident(src)) {
            await this._models.makeRoom(signal, BUSY_MESSAGE);
        }
    }
    _open({ pool, addon }, model) {
        const releaseWork = this._models.enterWork();
        try {
            return { held: pool.open(residentSrc(model, addon)), releaseWork };
        }
        catch (error) {
            releaseWork();
            throw error;
        }
    }
    async _voiceJob(voice, { model, signal }, run) {
        if (voice === this._tts) {
            await this._makeRoom(model, signal);
        }
        const { held, releaseWork } = this._open(voice, model);
        let job = null;
        let releaseAfter = null;
        let sdk = null;
        let modelId = null;
        try {
            modelId = (await raceAbort(held.load(), signal)).modelId;
            sdk = await this._loadSdk();
            const boundSdk = sdk;
            const boundId = modelId;
            job = this._lane(() => run(boundSdk, boundId));
            return await raceAbort(job, signal);
        }
        catch (err) {
            if (err instanceof AbortedError) {
                if (sdk && modelId) {
                    void sdk.cancel({ modelId, operation: 'inference' }).catch(noop);
                }
                releaseAfter = job ?? held.peek();
            }
            throw err;
        }
        finally {
            if (releaseAfter) {
                void releaseAfter.then(held.release, held.release).finally(releaseWork).catch(noop);
            }
            else {
                try {
                    held.release();
                }
                finally {
                    releaseWork();
                }
            }
        }
    }
}
function noop() { }
