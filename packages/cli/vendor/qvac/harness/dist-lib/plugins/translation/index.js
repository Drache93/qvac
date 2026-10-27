import { cleanAnswer } from '../../lib/helpers/clean-answer.js';
import { raceAbort } from '../../lib/helpers/race-abort.js';
import { retryMemo } from '../../lib/helpers/retry-memo.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { EURONANO_LANGUAGES, NMT_FROM_ENGLISH, NMT_TO_ENGLISH, SLM_LANGUAGE_CODES, SLM_LANGUAGE_NAMES, translationPlanFor } from './nmt-catalog.js';
import { createTranslate, createTranslateTool, createTranslationRuntime } from './translate.js';
PluginRegistry.requirePeers('translation', {
    '@qvac/langdetect-text': () => import.meta.resolve('@qvac/langdetect-text'),
    '@qvac/translation-nmtcpp': () => import.meta.resolve('@qvac/translation-nmtcpp/addonLogging')
});
function nmtSdk(models) {
    return retryMemo(async () => {
        const sdk = await models.sdk();
        if (typeof globalThis.Bare !== 'undefined') {
            const [{ nmtPlugin }, { registerPlugin }] = await Promise.all([
                import('@qvac/inference/nmtcpp-translation/plugin'),
                import('@qvac/inference/plugin-registry')
            ]);
            try {
                registerPlugin(nmtPlugin);
            }
            catch { }
        }
        return sdk;
    });
}
function slmTranslate(models) {
    return async (model, { text, from, to }, signal) => {
        const { modelId, release } = await models.completionModel(model, signal);
        try {
            const sdk = (await models.sdk());
            const answer = await raceAbort(sdk.translate({ modelId, text, from, to, stream: false, modelType: 'llm' }).text, signal);
            return cleanAnswer(answer, text);
        }
        finally {
            release();
        }
    };
}
export class TranslationPlugin {
    static NMT_TO_ENGLISH = NMT_TO_ENGLISH;
    static NMT_FROM_ENGLISH = NMT_FROM_ENGLISH;
    static EURONANO_LANGUAGES = EURONANO_LANGUAGES;
    static SLM_LANGUAGE_CODES = SLM_LANGUAGE_CODES;
    static SLM_LANGUAGE_NAMES = SLM_LANGUAGE_NAMES;
    static planFor(from, to) {
        return translationPlanFor(from, to);
    }
    name = 'translation';
    api = PluginRegistry.API_VERSION;
    provides = ['translation'];
    needs = ['models'];
    addons = {
        translation: () => import('@qvac/inference/nmtcpp-translation/plugin'),
        'translation-nmtcpp': () => import('@qvac/translation-nmtcpp/addonLogging')
    };
    setup(ctx) {
        const models = ctx.service('models');
        const runtime = createTranslationRuntime({
            loads: models,
            hold: models.hold,
            loadSdk: nmtSdk(models),
            onProgress: (model, progress) => models.emit(models.progressState(model, progress))
        });
        const options = { slm: slmTranslate(models) };
        const translation = { translate: createTranslate(runtime, options) };
        return {
            capabilities: [createTranslateTool(runtime, options)],
            services: { translation },
            unload: () => runtime.unload(),
            unloadIdle: () => runtime.unloadIdle()
        };
    }
}
