import { detectLanguage, UNDETERMINED } from '../../lib/capabilities/detect-language.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
PluginRegistry.requirePeers('language-hint', {
    '@qvac/langdetect-text': () => import.meta.resolve('@qvac/langdetect-text')
});
const TIMEOUT_MS = 120_000;
export class LanguageHint {
    name = 'language-hint';
    api = PluginRegistry.API_VERSION;
    needs = ['translation'];
    _minWords;
    _minProbability;
    constructor(options = {}) {
        this._minWords = options.minWords ?? 3;
        this._minProbability = options.minProbability ?? 0.5;
    }
    setup(ctx) {
        const translation = ctx.service('translation');
        const hook = {
            name: 'language-hint',
            phase: 'promptSubmit',
            timeoutMs: TIMEOUT_MS,
            run: (payload, options) => payload.phase === 'promptSubmit'
                ? this._hint(translation, payload.text, options)
                : undefined
        };
        return { hooks: [hook] };
    }
    async _hint(translation, text, options) {
        if (text.trim().split(/\s+/).length < this._minWords)
            return;
        const [top] = await detectLanguage({ text, topK: 2 });
        if (!top || top.code === UNDETERMINED || top.code === 'en') {
            return;
        }
        if ((top.probability ?? 0) < this._minProbability) {
            return;
        }
        const said = `The user wrote in ${top.language}.`;
        const answer = `Answer in ${top.language}.`;
        let english;
        try {
            english = await translation.translate({ text, from: top.code, to: 'en' }, options?.signal);
        }
        catch {
            return { context: `${said} ${answer}` };
        }
        return {
            context: 'error' in english
                ? `${said} ${answer}`
                : `${said} In English: "${english.text}". Work from the English. ${answer}`
        };
    }
}
