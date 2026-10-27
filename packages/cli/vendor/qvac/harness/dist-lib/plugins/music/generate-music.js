import process from 'process';
import ScopeLock from 'scope-lock';
import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { HarnessLog } from '../../lib/log.js';
import { AUDIOGEN_CATALOG, musicChoiceForDit, musicDefaultSteps, musicModelSet } from '../../lib/models/model-catalog.js';
import { GENERATE_MUSIC_TOOL } from '../../lib/models/music-catalog.js';
import { resolveModelSrc } from '../../lib/models/model-source.js';
export const MAX_DURATION_SECONDS = 300;
export const MIN_DURATION_SECONDS = 1;
export const MAX_STEPS = 60;
const MAX_CAPTION_CHARS = 4000;
const MAX_LYRICS_CHARS = 8000;
const MAX_TITLE_CHARS = 60;
const MAX_SEED = 0xffffffff;
const INSTRUMENTAL = '[Instrumental]';
const DEFAULT_VOCAL_LANGUAGE = 'en';
const MAX_VOCAL_LANGUAGE_CHARS = 16;
const MIN_BPM = 20;
const MAX_BPM = 300;
const MAX_MUSIC_META_CHARS = 32;
const STAGE_WEIGHT = {
    lm: { base: 0, span: 80 },
    dit: { base: 80, span: 17 },
    vae: { base: 97, span: 3 }
};
export function musicPercentTick(onPercent) {
    let last = -1;
    return ({ stage, step, total }) => {
        const weight = STAGE_WEIGHT[stage];
        if (!weight) {
            return;
        }
        const frac = total > 0 ? Math.min(1, Math.max(0, step / total)) : 0;
        const percentage = Math.min(100, Math.round(weight.base + frac * weight.span));
        if (percentage <= last) {
            return;
        }
        last = percentage;
        onPercent(percentage);
    };
}
const fingerprintOf = (stages, steps) => [stages.dit, stages.textEnc, stages.lm, stages.vae, steps ?? ''].join('\n');
const stagesFor = (modelChoice, base) => {
    const set = modelChoice ? musicModelSet(modelChoice) : null;
    return set ?? base;
};
function musicProgressName(dit) {
    const entry = AUDIOGEN_CATALOG.find((candidate) => candidate.dit.src === dit || candidate.dit.name === dit);
    return entry?.name ?? dit;
}
export function createMusicRuntime({ loadSdk, onProgress, onBeforeLoad, hold, loads = { track: (pending) => pending }, inferenceSteps: baseSteps, useGpu = true, ...base }) {
    let loading = null;
    let residentFingerprint = null;
    let busy = false;
    const lock = new ScopeLock();
    const defaultSteps = baseSteps ?? musicDefaultSteps(musicChoiceForDit(base.dit));
    const doUnload = async () => {
        const pending = loading;
        if (!pending) {
            residentFingerprint = null;
            return;
        }
        const loaded = await pending.catch(() => null);
        if (!loaded) {
            loading = null;
            residentFingerprint = null;
            return;
        }
        const sdk = await loadSdk();
        await sdk.unloadModel({ modelId: loaded.modelId });
        loading = null;
        residentFingerprint = null;
    };
    const unload = async () => {
        await lock.lock();
        try {
            await doUnload();
        }
        finally {
            lock.unlock();
        }
    };
    return {
        loadSdk,
        gpuRequested: useGpu,
        defaultSteps,
        ensureLoaded: async (sdk, { signal, modelChoice, inferenceSteps: steps } = {}) => {
            const stages = stagesFor(modelChoice, base);
            const effectiveSteps = steps ?? baseSteps;
            const fingerprint = fingerprintOf(stages, effectiveSteps);
            if (hold && !(loading && residentFingerprint === fingerprint)) {
                await hold(musicProgressName(stages.dit), 'audiogen', signal);
            }
            await lock.lock();
            try {
                if (loading && residentFingerprint !== fingerprint) {
                    await doUnload();
                }
                if (!loading && onBeforeLoad) {
                    await onBeforeLoad(signal, [stages.dit, stages.textEnc, stages.lm, stages.vae]);
                }
                residentFingerprint = fingerprint;
                loading ??= (async () => {
                    onProgress?.(musicProgressName(stages.dit), {});
                    const [textEncModelSrc, lmModelSrc, ditModelSrc, vaeModelSrc] = await Promise.all([
                        resolveModelSrc(sdk, stages.textEnc, 'audiogen'),
                        resolveModelSrc(sdk, stages.lm, 'audiogen'),
                        resolveModelSrc(sdk, stages.dit, 'audiogen'),
                        resolveModelSrc(sdk, stages.vae, 'audiogen')
                    ]);
                    const modelConfig = {
                        textEncModelSrc,
                        lmModelSrc,
                        ditModelSrc,
                        vaeModelSrc,
                        useGPU: useGpu,
                        inferenceSteps: effectiveSteps || undefined
                    };
                    const modelId = await loads.track(sdk.loadModel({
                        modelType: 'audiogen',
                        modelConfig,
                        onProgress: onProgress && ((progress) => onProgress(musicProgressName(stages.dit), progress))
                    }), sdk);
                    return { modelId };
                })().catch((err) => {
                    loading = null;
                    residentFingerprint = null;
                    throw err;
                });
            }
            finally {
                lock.unlock();
            }
            return raceAbort(loading, signal);
        },
        unload,
        unloadIdle: () => (busy ? Promise.resolve() : unload()),
        acquire: () => (busy ? false : (busy = true)),
        release: () => {
            busy = false;
        }
    };
}
export const BUSY_ERROR = 'a music generation is already running; try again when it finishes';
export async function runAudioGen(sdk, { modelId, params, signal, onTick }) {
    if (signal?.aborted) {
        return { error: 'music generation canceled' };
    }
    let run;
    try {
        run = sdk.audioGen({ modelId, ...params });
    }
    catch (err) {
        if (signal?.aborted) {
            return { error: 'music generation canceled' };
        }
        throw err;
    }
    const onAbort = () => {
        void sdk.cancel?.({ requestId: run.requestId }).catch(noop);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    let settled = false;
    try {
        const drained = (async () => {
            for await (const tick of run.progressStream) {
                if (!settled) {
                    onTick?.(tick);
                }
            }
        })().catch(noop);
        const audio = await run.audio;
        await drained;
        if (signal?.aborted) {
            return { error: 'music generation canceled' };
        }
        if (!audio?.pcm?.length) {
            return { error: 'the audiogen model produced no audio' };
        }
        const stats = await run.stats.catch(noop);
        return stats ? { ...audio, stats } : audio;
    }
    catch (err) {
        if (signal?.aborted) {
            return { error: 'music generation canceled' };
        }
        throw err;
    }
    finally {
        settled = true;
        signal?.removeEventListener('abort', onAbort);
    }
}
export function audioDurationSeconds(audio) {
    const bytesPerSample = audio.bitsPerSample / 8;
    if (bytesPerSample <= 0 || audio.channels <= 0 || audio.sampleRate <= 0) {
        return 0;
    }
    const samplesPerChannel = audio.pcm.byteLength / bytesPerSample / audio.channels;
    return Math.round(samplesPerChannel / audio.sampleRate);
}
export function presentStats(stats) {
    if (!stats)
        return undefined;
    const kept = {};
    for (const key of [
        'audioDurationMs',
        'totalTimeMs',
        'realTimeFactor',
        'backendDevice',
        'backendId'
    ]) {
        const value = stats[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            kept[key] = value;
        }
    }
    return Object.keys(kept).length > 0 ? kept : undefined;
}
export const CPU_FALLBACK_NOTICE = 'The GPU was unavailable, so this track was generated on the CPU and took much longer than usual.';
export function gpuFallback({ gpuRequested, stats }) {
    return gpuRequested && stats?.backendDevice === 0;
}
const BACKEND_NAMES = {
    0: 'cpu',
    1: 'metal',
    2: 'cuda',
    3: 'vulkan',
    4: 'opencl',
    99: 'other'
};
export function backendDevice(stats) {
    if (stats?.backendDevice === undefined)
        return 'unknown';
    return stats.backendDevice === 1 ? 'gpu' : 'cpu';
}
export function backendName(backendId) {
    if (backendId === undefined)
        return 'unknown';
    return BACKEND_NAMES[backendId] ?? `id-${backendId}`;
}
function logBackendUsed({ gpuRequested, stats, fallback }) {
    HarnessLog.diag('music.backend', {
        gpuRequested,
        backend: backendName(stats?.backendId),
        backendId: stats?.backendId ?? null,
        backendDevice: stats?.backendDevice ?? null,
        gpuFallback: fallback,
        platform: `${process.platform}-${process.arch}`
    });
}
export function pcmToWav(audio) {
    const { pcm, sampleRate, channels, bitsPerSample } = audio;
    const blockAlign = channels * (bitsPerSample / 8);
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const ascii = (offset, value) => {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(offset + i, value.charCodeAt(i));
        }
    };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + pcm.byteLength, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    ascii(36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    const wav = new Uint8Array(44 + pcm.byteLength);
    wav.set(new Uint8Array(header));
    wav.set(pcm, 44);
    return wav;
}
function parseArgs(args, defaults, maxDuration) {
    const caption = typeof args.prompt === 'string' ? args.prompt.trim() : '';
    if (!caption) {
        return { error: 'prompt must be a non-empty string' };
    }
    if (caption.length > MAX_CAPTION_CHARS) {
        return { error: `prompt exceeds ${MAX_CAPTION_CHARS} characters` };
    }
    let lyrics;
    if (typeof args.lyrics === 'string' && args.lyrics.trim()) {
        if (args.lyrics.length > MAX_LYRICS_CHARS) {
            return { error: `lyrics exceed ${MAX_LYRICS_CHARS} characters` };
        }
        lyrics = args.lyrics;
    }
    let duration = defaults.duration;
    if (args.duration !== undefined && args.duration !== null) {
        const n = Number(args.duration);
        if (!Number.isFinite(n) || n < MIN_DURATION_SECONDS || n > MAX_DURATION_SECONDS) {
            return {
                error: `duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds`
            };
        }
        duration = Math.round(n);
    }
    if (duration !== undefined) {
        duration = Math.min(duration, maxDuration);
    }
    let seed;
    if (args.seed !== undefined && args.seed !== null) {
        seed = Number(args.seed);
        if (!Number.isInteger(seed) || seed < -1 || seed > MAX_SEED) {
            return { error: `seed must be an integer between -1 (random) and ${MAX_SEED}` };
        }
        if (seed === -1) {
            seed = undefined;
        }
    }
    let vocalLanguage;
    if (typeof args.vocalLanguage === 'string' && args.vocalLanguage.trim()) {
        const lang = args.vocalLanguage.trim();
        if (lang.length > MAX_VOCAL_LANGUAGE_CHARS) {
            return { error: `vocalLanguage exceeds ${MAX_VOCAL_LANGUAGE_CHARS} characters` };
        }
        vocalLanguage = lang;
    }
    let bpm;
    if (args.bpm !== undefined && args.bpm !== null) {
        const n = Number(args.bpm);
        if (!Number.isInteger(n) || n < MIN_BPM || n > MAX_BPM) {
            return { error: `bpm must be an integer between ${MIN_BPM} and ${MAX_BPM}` };
        }
        bpm = n;
    }
    const keyscale = musicMeta(args.keyscale);
    const timesignature = musicMeta(args.timesignature);
    const title = fileNameBase(typeof args.title === 'string' ? args.title : undefined);
    return { caption, title, lyrics, duration, seed, vocalLanguage, bpm, keyscale, timesignature };
}
function musicFileName(title, caption) {
    const base = title ?? fileNameBase(caption) ?? `generated-${Date.now()}`;
    return `${base}.wav`;
}
function fileNameBase(value) {
    const stem = value
        ?.toLowerCase()
        .replace(/\.wav$/i, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_TITLE_CHARS)
        .replace(/-+$/, '');
    return stem || undefined;
}
function musicMeta(value) {
    if (typeof value !== 'string' || !value.trim())
        return undefined;
    return value.trim().slice(0, MAX_MUSIC_META_CHARS);
}
const VOCAL_CAPTION = /\b(?:vocal(?:ists?|s)?|sing(?:s|ing|ers?)?|sung|voices?|duet|choir|a ?cappella|acapella|rap(?:s|ping|per)?|chant(?:s|ing|ed)?)\b(?![\s-]*(?:chops?|fx|samples?|pads?|synths?|stabs?|textures?)\b)/i;
const INSTRUMENTAL_INTENT = /\b(?:instrumental|no vocals?|without vocals?|no singing|no lyrics|karaoke)\b/i;
function captionImpliesVocals(caption) {
    return VOCAL_CAPTION.test(caption) && !INSTRUMENTAL_INTENT.test(caption);
}
export function settingsDuration(value, maxDuration) {
    if (!value)
        return undefined;
    return Math.min(maxDuration, Math.max(MIN_DURATION_SECONDS, Math.round(value)));
}
export function settingsSteps(value, maxSteps = MAX_STEPS) {
    if (!value || !Number.isInteger(value))
        return undefined;
    return Math.min(maxSteps, Math.max(1, value));
}
export function normalizeClamps(clamps) {
    const maxDuration = clamps?.maxDuration
        ? Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.floor(clamps.maxDuration)))
        : MAX_DURATION_SECONDS;
    const maxSteps = clamps?.maxSteps
        ? Math.min(MAX_STEPS, Math.max(1, Math.floor(clamps.maxSteps)))
        : MAX_STEPS;
    return { maxDuration, maxSteps };
}
export function resolveMusicSettings(ctx) {
    const settings = ctx?.settings;
    if (!settings) {
        return {};
    }
    const out = {};
    if (typeof settings.modelChoice === 'string' && settings.modelChoice) {
        out.modelChoice = settings.modelChoice;
    }
    if (typeof settings.steps === 'number' && Number.isFinite(settings.steps)) {
        out.steps = settings.steps;
    }
    if (typeof settings.duration === 'number' && Number.isFinite(settings.duration)) {
        out.duration = settings.duration;
    }
    return out;
}
export function createGenerateMusicTool(runtime, clamps) {
    const cap = normalizeClamps(clamps);
    const stepsCap = clamps?.maxSteps ? cap.maxSteps : undefined;
    return {
        name: GENERATE_MUSIC_TOOL,
        toolset: 'music',
        skillGated: true,
        description: 'Generate music or other audio from a text description using the local ACE-Step model. ' +
            'The prompt describes the genre, instruments, mood, and tempo in plain language. ' +
            'Optional `lyrics` add sung vocals (omit for an instrumental). `duration` is in seconds ' +
            `(approximate, max ${cap.maxDuration} on this device). The generated audio is saved as a ` +
            'chat attachment and shown to the user automatically; the attachment id is returned to you. ' +
            'Use this when the user asks for a song, track, beat, melody, jingle, or sound.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'The music to generate: genre, instruments, mood, tempo'
                },
                title: {
                    type: 'string',
                    description: 'A short, descriptive song title for this track, 2 to 5 words. Used to name the ' +
                        'saved audio file, so keep it human-readable and omit any file extension.'
                },
                lyrics: {
                    type: 'string',
                    description: 'Optional sung lyrics; omit for an instrumental. Use [verse]/[chorus] tags.'
                },
                vocalLanguage: {
                    type: 'string',
                    description: 'Language the vocals are sung in, as a short code (e.g. "en", "es", "de", "it"). ' +
                        'Only applies when lyrics have vocals; defaults to English.'
                },
                duration: {
                    type: 'number',
                    description: `Approximate length in seconds, max ${cap.maxDuration}`
                },
                seed: { type: 'number', description: 'Reproducibility seed; -1 or omitted = random' },
                bpm: {
                    type: 'number',
                    description: 'Tempo in beats per minute, when the user asks for a specific tempo'
                },
                keyscale: {
                    type: 'string',
                    description: 'Musical key and scale, e.g. "C minor" or "A major", when the user names one'
                },
                timesignature: {
                    type: 'string',
                    description: 'Time signature, e.g. "4/4" or "3/4", when the user names one'
                }
            },
            required: ['prompt']
        },
        resource: (args) => ({
            kind: 'music-generation',
            label: String(args.prompt ?? '').slice(0, 80)
        }),
        effect: () => 'read',
        execute: async (args, ctx) => {
            const music = resolveMusicSettings(ctx);
            const parsed = parseArgs(args, { duration: settingsDuration(music.duration, cap.maxDuration) }, cap.maxDuration);
            if ('error' in parsed) {
                return parsed;
            }
            if (!ctx?.attach) {
                return { error: 'this device cannot persist generated audio' };
            }
            if (!runtime.acquire()) {
                return { error: BUSY_ERROR, code: 'busy' };
            }
            const report = ctx.progress;
            const onTick = report && musicPercentTick((percentage) => report({ percentage }));
            const capMax = stepsCap ?? MAX_STEPS;
            const choiceDefault = music.modelChoice ? musicDefaultSteps(music.modelChoice) : undefined;
            const steps = settingsSteps(music.steps, capMax) ??
                settingsSteps(choiceDefault ?? runtime.defaultSteps, capMax) ??
                stepsCap;
            try {
                const sdk = await runtime.loadSdk();
                const { modelId } = await runtime.ensureLoaded(sdk, {
                    signal: ctx.signal,
                    modelChoice: music.modelChoice,
                    inferenceSteps: steps
                });
                const hasVocals = parsed.lyrics !== undefined &&
                    parsed.lyrics.trim().toLowerCase() !== INSTRUMENTAL.toLowerCase();
                const instrumental = !hasVocals;
                const vocalLanguage = hasVocals
                    ? (parsed.vocalLanguage ?? DEFAULT_VOCAL_LANGUAGE)
                    : undefined;
                const result = await runAudioGen(sdk, {
                    modelId,
                    params: {
                        caption: parsed.caption,
                        lyrics: hasVocals ? parsed.lyrics : INSTRUMENTAL,
                        duration: parsed.duration,
                        seed: parsed.seed,
                        vocalLanguage: vocalLanguage || undefined,
                        bpm: parsed.bpm,
                        keyscale: parsed.keyscale || undefined,
                        timesignature: parsed.timesignature || undefined
                    },
                    signal: ctx.signal,
                    onTick
                });
                if ('error' in result) {
                    return result;
                }
                const wav = pcmToWav(result);
                const record = await ctx.attach({
                    fileName: musicFileName(parsed.title, parsed.caption),
                    mimeType: 'audio/wav',
                    bytes: wav,
                    raw: true
                });
                const stats = presentStats(result.stats);
                const fallback = gpuFallback({ gpuRequested: runtime.gpuRequested, stats });
                const notice = fallback ? CPU_FALLBACK_NOTICE : undefined;
                logBackendUsed({ gpuRequested: runtime.gpuRequested, stats, fallback });
                ctx.reportBackend?.({
                    tool: GENERATE_MUSIC_TOOL,
                    requestedGpu: runtime.gpuRequested,
                    device: backendDevice(stats),
                    backend: backendName(stats?.backendId)
                });
                return {
                    attachmentId: record.id,
                    fileName: record.fileName,
                    byteLength: record.byteLength,
                    durationSeconds: audioDurationSeconds(result),
                    sampleRate: result.sampleRate,
                    channels: result.channels,
                    instrumental,
                    note: instrumental && captionImpliesVocals(parsed.caption)
                        ? 'This track is instrumental: no lyrics were provided, so the model did not sing. ' +
                            'The prompt described vocals; to produce a sung version, call generate_music again ' +
                            'with lyrics ([verse]/[chorus] tags). Otherwise describe this track as instrumental, not vocal.'
                        : undefined,
                    hostNotice: notice,
                    data: stats ? { stats } : undefined
                };
            }
            catch (err) {
                if (err instanceof AbortedError) {
                    return { error: 'music generation canceled' };
                }
                throw err;
            }
            finally {
                runtime.release();
                report?.(null);
            }
        }
    };
}
function noop() { }
