export const ENGLISH = 'en';
const TO_ENGLISH = [
    'ar',
    'az',
    'be',
    'bg',
    'bn',
    'bs',
    'ca',
    'cs',
    'da',
    'de',
    'el',
    'es',
    'et',
    'fa',
    'fi',
    'fr',
    'gu',
    'he',
    'hi',
    'hr',
    'hu',
    'id',
    'is',
    'it',
    'ja',
    'kn',
    'ko',
    'lt',
    'lv',
    'ml',
    'ms',
    'mt',
    'nb',
    'nl',
    'nn',
    'no',
    'pl',
    'pt',
    'ro',
    'ru',
    'sk',
    'sl',
    'sq',
    'sr',
    'sv',
    'ta',
    'te',
    'th',
    'tr',
    'uk',
    'vi',
    'zh'
];
const FROM_ENGLISH = TO_ENGLISH.filter((code) => !['be', 'mt', 'nn'].includes(code));
export const NMT_TO_ENGLISH = TO_ENGLISH;
export const NMT_FROM_ENGLISH = FROM_ENGLISH;
const SLM_LANGUAGES = [
    { iso: 'af', flores: 'afr_Latn', name: 'Afrikaans' },
    { iso: 'am', flores: 'amh_Ethi', name: 'Amharic' },
    { iso: 'ha', flores: 'hau_Latn', name: 'Hausa' },
    { iso: 'ig', flores: 'ibo_Latn', name: 'Igbo' },
    { iso: 'rw', flores: 'kin_Latn', name: 'Kinyarwanda' },
    { iso: 'mg', flores: 'plt_Latn', name: 'Malagasy' },
    { iso: 'ny', flores: 'nya_Latn', name: 'Nyanja' },
    { iso: 'om', flores: 'gaz_Latn', name: 'Oromo' },
    { iso: 'sn', flores: 'sna_Latn', name: 'Shona' },
    { iso: 'so', flores: 'som_Latn', name: 'Somali' },
    { iso: 'st', flores: 'sot_Latn', name: 'Southern Sotho' },
    { iso: 'sw', flores: 'swh_Latn', name: 'Swahili' },
    { iso: 'tn', flores: 'tsn_Latn', name: 'Tswana' },
    { iso: 'xh', flores: 'xho_Latn', name: 'Xhosa' },
    { iso: 'yo', flores: 'yor_Latn', name: 'Yoruba' },
    { iso: 'zu', flores: 'zul_Latn', name: 'Zulu' }
];
export const SLM_MODEL = 'TranslatePsy-AfriSLM-0.8B-Q4_K_M-imat';
const EURONANO = 'https://huggingface.co/qvac/TranslatePsy-EuroNano/resolve/main';
const EURONANO_SIZE = 'Base';
export const EURONANO_LANGUAGES = [
    'cs',
    'de',
    'es',
    'fi',
    'fr',
    'it',
    'nl',
    'pt',
    'sv'
];
function euroNanoPack(direction) {
    const dir = `${EURONANO}/${direction}/${EURONANO_SIZE}/intgemm`;
    return { model: `${dir}/model.intgemm.alphas.bin`, vocab: `${dir}/vocab.spm` };
}
export const SLM_LANGUAGE_CODES = SLM_LANGUAGES.map((entry) => entry.iso);
export function languageLabel(code) {
    const wanted = code.toLowerCase();
    return SLM_LANGUAGES.find((entry) => entry.flores.toLowerCase() === wanted || entry.iso === wanted)?.name;
}
export const SLM_LANGUAGE_NAMES = SLM_LANGUAGES.map(({ iso, name }) => ({ code: iso, name }));
export function slmLanguage(code) {
    const wanted = code.toLowerCase();
    return SLM_LANGUAGES.find((entry) => entry.flores.toLowerCase() === wanted || entry.iso === wanted)?.flores;
}
const modelFilter = (pair) => `model.${pair}.intgemm`;
export function sameLanguage(from, to) {
    return canonical(from) === canonical(to);
}
function canonical(code) {
    return slmLanguage(code) ?? code.toLowerCase();
}
export function translationPlanFor(requestedFrom, requestedTo) {
    const from = requestedFrom.toLowerCase();
    const to = requestedTo.toLowerCase();
    if (sameLanguage(from, to)) {
        return { error: `${from} is already the target language` };
    }
    const slmFrom = slmLanguage(from);
    const slmTo = slmLanguage(to);
    if (slmFrom || slmTo) {
        return { route: 'slm', from: slmFrom ?? from, to: slmTo ?? to, model: SLM_MODEL };
    }
    if (to === ENGLISH && EURONANO_LANGUAGES.includes(from)) {
        const pack = euroNanoPack('xx-en');
        return {
            route: 'nmt',
            from,
            to,
            model: pack.model,
            srcVocab: pack.vocab,
            dstVocab: pack.vocab
        };
    }
    if (from === ENGLISH && EURONANO_LANGUAGES.includes(to)) {
        const pack = euroNanoPack('en-xx');
        return {
            route: 'nmt',
            from,
            to,
            model: pack.model,
            srcVocab: pack.vocab,
            dstVocab: pack.vocab,
            tag: `##${to.toUpperCase()}`
        };
    }
    if (to === ENGLISH) {
        if (!TO_ENGLISH.includes(from)) {
            return { error: `cannot translate from ${from}` };
        }
        return { route: 'nmt', from, to, model: modelFilter(`${from}${ENGLISH}`) };
    }
    if (!FROM_ENGLISH.includes(to)) {
        return { error: `cannot translate to ${to}` };
    }
    if (from === ENGLISH) {
        return { route: 'nmt', from, to, model: modelFilter(`${ENGLISH}${to}`) };
    }
    if (!TO_ENGLISH.includes(from)) {
        return { error: `cannot translate from ${from}` };
    }
    return {
        route: 'nmt',
        from,
        to,
        model: modelFilter(`${from}${ENGLISH}`),
        pivot: modelFilter(`${ENGLISH}${to}`)
    };
}
