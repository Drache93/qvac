import ScopeLock from 'scope-lock';
import { detectLanguage, languageName, UNDETERMINED } from '../../lib/capabilities/detect-language.js';
import { HarnessError } from '../../lib/errors.js';
import { createLoadStall } from '../../lib/helpers/load-stall.js';
import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { resolveModelSrc } from '../../lib/models/model-source.js';
import { ENGLISH, NMT_FROM_ENGLISH, NMT_TO_ENGLISH, languageLabel, SLM_LANGUAGE_CODES, sameLanguage, translationPlanFor } from './nmt-catalog.js';
export const TRANSLATION_LOAD_STALL_MS = 15 * 60_000;
function packName(plan) {
    const pair = plan.model.match(/model\.([a-z]+)\.intgemm/)?.[1];
    if (pair) {
        return `Bergamot ${pair}`;
    }
    return plan.model.includes('/en-xx/') ? 'EuroNano en-xx' : 'EuroNano xx-en';
}
const fingerprintOf = (plan) => `${plan.model}|${plan.pivot ?? ''}`;
function bergamotConfig(plan) {
    const config = { engine: 'Bergamot', from: plan.from, to: plan.to };
    if (plan.srcVocab) {
        config.srcVocabSrc = plan.srcVocab;
    }
    if (plan.dstVocab) {
        config.dstVocabSrc = plan.dstVocab;
    }
    return config;
}
export function createTranslationRuntime({ loadSdk, loads = { track: (pending) => pending }, onProgress, hold, stallMs = TRANSLATION_LOAD_STALL_MS }) {
    let loading = null;
    let residentFingerprint = null;
    let inFlight = 0;
    const lock = new ScopeLock();
    const turn = new ScopeLock();
    const loadPack = async (sdk, plan) => {
        const modelSrc = await resolveModelSrc(sdk, plan.model, 'nmt');
        const modelConfig = bergamotConfig(plan);
        if (plan.pivot) {
            modelConfig.pivotModel = { modelSrc: await resolveModelSrc(sdk, plan.pivot, 'nmt') };
        }
        const name = packName(plan);
        const stall = createLoadStall(stallMs, () => new HarnessError('TRANSLATION_LOAD_STALLED'));
        onProgress?.(name, {});
        const pending = sdk.loadModel({
            modelSrc,
            modelType: 'nmtcpp-translation',
            modelConfig,
            onProgress: (progress) => {
                stall.bump();
                onProgress?.(name, progress);
            }
        });
        try {
            const modelId = await Promise.race([loads.track(pending), stall.promise]);
            return { modelId };
        }
        catch (err) {
            if (HarnessError.is(err, 'TRANSLATION_LOAD_STALLED') && pending.requestId) {
                void sdk.cancel?.({ requestId: pending.requestId }).catch(noop);
            }
            throw err;
        }
        finally {
            stall.clear();
        }
    };
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
        ensureLoaded: async (sdk, plan, signal) => {
            const fingerprint = fingerprintOf(plan);
            if (hold && !(loading && residentFingerprint === fingerprint)) {
                for (const model of plan.pivot ? [plan.model, plan.pivot] : [plan.model]) {
                    await hold(model, 'nmt', signal);
                }
            }
            await lock.lock();
            try {
                if (loading && residentFingerprint !== fingerprint) {
                    await doUnload();
                }
                residentFingerprint = fingerprint;
                loading ??= loadPack(sdk, plan).catch((err) => {
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
        unloadIdle: () => (inFlight > 0 ? Promise.resolve() : unload()),
        enter: async (signal) => {
            inFlight++;
            const pending = turn.lock();
            try {
                await raceAbort(pending, signal);
            }
            catch (err) {
                inFlight--;
                void pending.then(() => turn.unlock());
                throw err;
            }
        },
        exit: () => {
            inFlight--;
            turn.unlock();
        }
    };
}
export async function stripLanguageLabel(text, ...codes) {
    const at = text.indexOf(':');
    if (at === -1) {
        return text;
    }
    const head = text.slice(0, at).trim();
    const labels = await Promise.all(codes.map((code) => languageLabel(code) ?? languageName(code)));
    return labels.includes(head) ? text.slice(at + 1).trim() : text;
}
export function parseTranslateArgs(args) {
    const text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text) {
        return { error: 'text must be a non-empty string' };
    }
    const to = typeof args.to === 'string' ? args.to.trim() : '';
    if (!to) {
        return { error: 'to must be a language code' };
    }
    const from = typeof args.from === 'string' ? args.from.trim() : undefined;
    return { text, to, from };
}
export async function sourceLanguage(text, from) {
    if (from)
        return from;
    const [{ code }] = await detectLanguage({ text });
    if (code === UNDETERMINED) {
        return { error: NEEDS_SOURCE };
    }
    return code;
}
const NEEDS_SOURCE = 'could not detect the source language; pass `from` explicitly';
export function createTranslate(runtime, { slm } = {}) {
    return async (request, signal) => {
        const from = await sourceLanguage(request.text, request.from);
        if (typeof from === 'object') {
            return from;
        }
        if (sameLanguage(from, request.to)) {
            return { text: request.text, from, to: request.to, engine: 'none' };
        }
        const plan = translationPlanFor(from, request.to);
        if ('error' in plan) {
            return plan;
        }
        if (plan.route === 'slm' && !slm) {
            return { error: `this device cannot translate ${from} to ${request.to}` };
        }
        let entered = false;
        try {
            await runtime.enter(signal);
            entered = true;
            if (plan.route === 'slm') {
                if (!slm) {
                    throw new HarnessError('SLM_TRANSLATION_UNAVAILABLE');
                }
                const text = await slm(plan.model, { text: request.text, from: plan.from, to: plan.to }, signal);
                return {
                    text: await stripLanguageLabel(text, plan.from, plan.to),
                    from,
                    to: request.to,
                    engine: 'slm',
                    model: plan.model
                };
            }
            const sdk = await runtime.loadSdk();
            const { modelId } = await runtime.ensureLoaded(sdk, plan, signal);
            const source = plan.tag ? `${plan.tag} ${request.text}` : request.text;
            const text = await raceAbort(sdk.translate({ modelId, text: source, stream: false, modelType: 'nmt' }).text, signal);
            return { text, from, to: request.to, engine: 'nmt', pivoted: Boolean(plan.pivot) };
        }
        catch (err) {
            if (err instanceof AbortedError) {
                return { error: 'translation canceled' };
            }
            throw err;
        }
        finally {
            if (entered) {
                runtime.exit();
            }
        }
    };
}
export function createTranslateTool(runtime, options = {}) {
    const translate = createTranslate(runtime, options);
    return {
        name: 'translate',
        toolset: null,
        description: 'Translate text between languages using the local neural translation models. ' +
            `\`to\` and \`from\` are ISO 639-1 codes. Translating into ${ENGLISH} supports ` +
            `${NMT_TO_ENGLISH.length} languages and out of it ${NMT_FROM_ENGLISH.length}; a pair ` +
            'with English on neither side is translated through English, except between the ' +
            'languages below. ' +
            `${SLM_LANGUAGE_CODES.length} further languages, mostly African, may also be named by ` +
            'their FLORES-200 code and always need an explicit `from`, which the detector cannot ' +
            'name. Elsewhere `from` is detected from the text when omitted; pass it when known.',
        parameters: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'The text to translate' },
                to: {
                    type: 'string',
                    description: 'Target language as an ISO 639-1 code, e.g. `es`, or a FLORES-200 code'
                },
                from: {
                    type: 'string',
                    description: 'Source language as an ISO 639-1 or FLORES-200 code; detected from the text when omitted'
                }
            },
            required: ['text', 'to']
        },
        effect: () => 'read',
        resource: (args) => ({ kind: 'translation', label: String(args.to ?? '') }),
        execute: async (args, ctx) => {
            const parsed = parseTranslateArgs(args);
            return 'error' in parsed ? parsed : translate(parsed, ctx?.signal);
        }
    };
}
function noop() { }
