import ScopeLock from 'scope-lock';
import { HarnessError } from '../../lib/errors.js';
import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { DIFFUSION_CATALOG, imageModelFor } from '../../lib/models/model-catalog.js';
import { createLoadStall } from '../../lib/helpers/load-stall.js';
import { resolveModelSrc } from '../../lib/models/model-source.js';
export const MAX_DIM = 1024;
export const DIM_STEP = 64;
const DEFAULT_DIM = 512;
export const MAX_STEPS = 100;
const MAX_PROMPT_CHARS = 4000;
const MAX_SEED = 0xffffffff;
export const IMAGE_LOAD_STALL_MS = 15 * 60_000;
export function generationPercentTick(onPercent, encodePhases = 0) {
    let phase = 0;
    let prevStep = -1;
    let prevTotal = 0;
    let last = -1;
    return ({ step, totalSteps }) => {
        if (prevStep !== -1 && (step < prevStep || (totalSteps !== prevTotal && prevTotal !== 0))) {
            phase++;
        }
        prevStep = step;
        prevTotal = totalSteps;
        if (phase !== encodePhases) {
            return;
        }
        const percentage = totalSteps > 0 ? Math.min(100, Math.max(0, Math.round((step / totalSteps) * 100))) : 0;
        if (percentage <= last) {
            return;
        }
        last = percentage;
        onPercent(percentage);
    };
}
const fingerprintOf = (set) => [set.model, set.llmModel ?? '', set.vaeModel ?? '', set.prediction ?? ''].join('\n');
function diffusionProgressName(set) {
    const entry = DIFFUSION_CATALOG.find((candidate) => candidate.model.src === set.model);
    return entry?.name ?? set.model;
}
export function createDiffusionRuntime({ loadSdk, onProgress, onLoaded, onBeforeLoad, hold, loads = { track: (pending) => pending }, stallMs = IMAGE_LOAD_STALL_MS, ...base }) {
    let loading = null;
    let residentFingerprint = null;
    let busy = false;
    const lock = new ScopeLock();
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
        predictionFor: (modelChoice) => ((modelChoice && imageModelFor(modelChoice)) || base).prediction,
        ensureLoaded: async (sdk, signal, modelChoice) => {
            const set = (modelChoice && imageModelFor(modelChoice)) || base;
            const fingerprint = fingerprintOf(set);
            if (hold && !(loading && residentFingerprint === fingerprint)) {
                await hold(diffusionProgressName(set), 'diffusion', signal);
            }
            await lock.lock();
            try {
                if (loading && residentFingerprint !== fingerprint) {
                    await doUnload();
                }
                if (!loading && onBeforeLoad) {
                    await onBeforeLoad(signal, [set.model, set.llmModel, set.vaeModel].filter((src) => src !== undefined));
                }
                residentFingerprint = fingerprint;
                loading ??= (async () => {
                    onProgress?.(diffusionProgressName(set), {});
                    const modelSrc = await resolveModelSrc(sdk, set.model, 'diffusion');
                    const config = {};
                    if (set.prediction) {
                        config.prediction = set.prediction;
                    }
                    if (set.llmModel) {
                        config.llmModelSrc = await resolveModelSrc(sdk, set.llmModel, 'llm');
                    }
                    if (set.vaeModel) {
                        config.vaeModelSrc = await resolveModelSrc(sdk, set.vaeModel, 'diffusion');
                    }
                    const modelConfig = Object.keys(config).length ? config : undefined;
                    const stall = createLoadStall(stallMs, () => new HarnessError('IMAGE_LOAD_STALLED'));
                    const pending = sdk.loadModel({
                        modelSrc,
                        modelType: 'diffusion',
                        modelConfig,
                        onProgress: (progress) => {
                            stall.bump();
                            onProgress?.(diffusionProgressName(set), progress);
                        }
                    });
                    try {
                        const modelId = await Promise.race([loads.track(pending, sdk), stall.promise]);
                        onLoaded?.(diffusionProgressName(set));
                        return { modelId, prediction: set.prediction };
                    }
                    catch (err) {
                        if (HarnessError.is(err, 'IMAGE_LOAD_STALLED') && pending.requestId) {
                            void sdk.cancel?.({ requestId: pending.requestId }).catch(noop);
                        }
                        throw err;
                    }
                    finally {
                        stall.clear();
                    }
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
export const BUSY_ERROR = 'an image generation is already running; try again when it finishes';
export async function runDiffusion(sdk, { modelId, params, signal, onTick }) {
    const onAbort = () => {
        void sdk.cancel?.({ operation: 'inference', modelId }).catch(noop);
    };
    if (signal?.aborted) {
        return { error: 'image generation canceled' };
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    let settled = false;
    try {
        const run = sdk.diffusion({ modelId, vae_tiling: true, ...params });
        const drained = (async () => {
            for await (const tick of run.progressStream) {
                if (!settled) {
                    onTick?.(tick);
                }
            }
        })().catch(noop);
        const outputs = await run.outputs;
        await drained;
        const image = outputs[0];
        if (signal?.aborted) {
            return { error: 'image generation canceled' };
        }
        if (!image?.length) {
            return { error: 'the diffusion model produced no image' };
        }
        return image;
    }
    catch (err) {
        if (signal?.aborted) {
            return { error: 'image generation canceled' };
        }
        throw err;
    }
    finally {
        settled = true;
        signal?.removeEventListener('abort', onAbort);
    }
}
export function parseCommonArgs(args, maxSteps = MAX_STEPS) {
    const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
    if (!prompt) {
        return { error: 'prompt must be a non-empty string' };
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
        return { error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` };
    }
    let steps;
    if (args.steps !== undefined && args.steps !== null) {
        steps = Number(args.steps);
        if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) {
            return { error: `steps must be an integer between 1 and ${MAX_STEPS}` };
        }
        steps = Math.min(steps, maxSteps);
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
    const negativePrompt = typeof args.negative_prompt === 'string' ? args.negative_prompt : undefined;
    if (negativePrompt && negativePrompt.length > MAX_PROMPT_CHARS) {
        return { error: `negative_prompt exceeds ${MAX_PROMPT_CHARS} characters` };
    }
    return { prompt, steps, seed, negativePrompt };
}
export function normalizeClamps(clamps) {
    const maxDim = clamps?.maxDim
        ? Math.min(MAX_DIM, Math.max(DIM_STEP, Math.floor(clamps.maxDim / DIM_STEP) * DIM_STEP))
        : MAX_DIM;
    const maxSteps = clamps?.maxSteps
        ? Math.min(MAX_STEPS, Math.max(1, Math.floor(clamps.maxSteps)))
        : MAX_STEPS;
    return { maxDim, maxSteps };
}
function dimension(value, { name, fallback, maxDim = MAX_DIM }) {
    if (value === undefined || value === null)
        return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < DIM_STEP || n > MAX_DIM) {
        return { error: `${name} must be an integer between ${DIM_STEP} and ${MAX_DIM}` };
    }
    return Math.min(maxDim, Math.round(n / DIM_STEP) * DIM_STEP);
}
export function settingsDimension(value, maxDim = MAX_DIM) {
    if (!value)
        return undefined;
    return Math.min(maxDim, Math.max(DIM_STEP, Math.round(value / DIM_STEP) * DIM_STEP));
}
export function settingsSteps(value, maxSteps = MAX_STEPS) {
    if (!value || !Number.isInteger(value))
        return undefined;
    return Math.min(maxSteps, Math.max(1, value));
}
export function effectiveSteps(parsedSteps, settingsValue, stepsCap) {
    if (parsedSteps !== undefined)
        return parsedSteps;
    return settingsSteps(settingsValue, stepsCap ?? MAX_STEPS) ?? stepsCap;
}
function parseArgs(args, defaults, cap) {
    const common = parseCommonArgs(args, cap.maxSteps);
    if ('error' in common) {
        return common;
    }
    const fallback = Math.min(DEFAULT_DIM, cap.maxDim);
    const width = dimension(args.width, {
        name: 'width',
        fallback: defaults.width ?? fallback,
        maxDim: cap.maxDim
    });
    if (typeof width === 'object') {
        return width;
    }
    const height = dimension(args.height, {
        name: 'height',
        fallback: defaults.height ?? fallback,
        maxDim: cap.maxDim
    });
    if (typeof height === 'object') {
        return height;
    }
    return { ...common, width, height };
}
export function createGenerateImageTool(runtime, clamps) {
    const cap = normalizeClamps(clamps);
    const stepsCap = clamps?.maxSteps ? cap.maxSteps : undefined;
    return {
        name: 'generate_image',
        toolset: 'image',
        skillGated: true,
        description: 'Generate an image from a text prompt using the local diffusion model. ' +
            `Width and height default to ${Math.min(DEFAULT_DIM, cap.maxDim)}, max ${cap.maxDim} ` +
            'on this device, snapped to the 64px grid. The image ' +
            'is saved as a chat attachment and shown to the user automatically; the attachment ' +
            'id is returned to you. `negative_prompt` (optional) describes what the image ' +
            'should NOT contain. Use this when the user asks for an image, picture, ' +
            'illustration, or drawing. If the user wants an existing image changed, use ' +
            '`edit_image` instead.',
        parameters: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'What the image should depict' },
                width: {
                    type: 'number',
                    description: `Pixels, max ${cap.maxDim}, snapped to the 64px grid`
                },
                height: {
                    type: 'number',
                    description: `Pixels, max ${cap.maxDim}, snapped to the 64px grid`
                },
                steps: {
                    type: 'number',
                    description: `Diffusion steps (model default when omitted, max ${cap.maxSteps})`
                },
                seed: { type: 'number', description: 'Reproducibility seed; -1 or omitted = random' },
                negative_prompt: { type: 'string', description: 'What the image should NOT contain' }
            },
            required: ['prompt']
        },
        effect: () => 'read',
        resource: (args) => ({
            kind: 'image-generation',
            label: String(args.prompt ?? '').slice(0, 80)
        }),
        execute: async (args, ctx) => {
            const parsed = parseArgs(args, {
                width: settingsDimension(ctx?.image?.width, cap.maxDim),
                height: settingsDimension(ctx?.image?.height, cap.maxDim)
            }, cap);
            if ('error' in parsed) {
                return parsed;
            }
            if (!ctx?.attach) {
                return { error: 'this device cannot persist generated images' };
            }
            if (!runtime.acquire()) {
                return { error: BUSY_ERROR, code: 'busy' };
            }
            const report = ctx.progress;
            const onTick = report && generationPercentTick((percentage) => report({ percentage }));
            try {
                const sdk = await runtime.loadSdk();
                const { modelId } = await runtime.ensureLoaded(sdk, ctx.signal, ctx.image?.modelChoice);
                const image = await runDiffusion(sdk, {
                    modelId,
                    params: {
                        prompt: parsed.prompt,
                        width: parsed.width,
                        height: parsed.height,
                        steps: effectiveSteps(parsed.steps, ctx.image?.steps, stepsCap),
                        seed: parsed.seed,
                        negative_prompt: parsed.negativePrompt
                    },
                    signal: ctx.signal,
                    onTick
                });
                if (!(image instanceof Uint8Array)) {
                    return image;
                }
                const record = await ctx.attach({
                    fileName: `generated-${Date.now()}.png`,
                    mimeType: 'image/png',
                    bytes: image,
                    raw: true
                });
                return {
                    attachmentId: record.id,
                    fileName: record.fileName,
                    byteLength: record.byteLength,
                    width: parsed.width,
                    height: parsed.height
                };
            }
            catch (err) {
                if (err instanceof AbortedError) {
                    return { error: 'image generation canceled' };
                }
                if (HarnessError.is(err, 'IMAGE_LOAD_STALLED')) {
                    return { error: HarnessError.IMAGE_LOAD_STALL_ERROR };
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
