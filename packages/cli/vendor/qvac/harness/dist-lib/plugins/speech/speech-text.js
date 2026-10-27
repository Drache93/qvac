import { ascii } from 'asenion';
import { CURRENCY_CODES, SPEECH_LEXICON } from './speech-lexicon.js';
const EMOJI_MODIFIERS = /[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu;
const UNSPEAKABLE = /[^\nA-Za-z0-9 .,;:!?'"()\u002D_]/gu;
const MOSS_UNSPEAKABLE = /\p{Extended_Pictographic}/gu;
const MOSS_DIRECTION = /(\[(?:pause[^\]]*|S\d)\]|(?<![\w/])\/[^/\s]+\/(?![\w/]))/;
export function normalizeForSpeech(text, lang = 'en') {
    return filterUnspeakable(toSpokenText(text, lang), UNSPEAKABLE);
}
export function normalizeForMoss(text, lang = 'en') {
    const parts = stripMarkup(foldWhitespace(text)).split(MOSS_DIRECTION);
    const spoken = parts.map((part, index) => index % 2 ? part : verbalize(part.normalize('NFKC').replace(EMOJI_MODIFIERS, ''), lang));
    return filterUnspeakable(spoken.join(''), MOSS_UNSPEAKABLE);
}
function toSpokenText(text, lang) {
    const folded = stripMarkup(foldWhitespace(text)).normalize('NFKC').replace(EMOJI_MODIFIERS, '');
    return ascii(verbalize(folded, lang));
}
function foldWhitespace(text) {
    return text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
}
function stripMarkup(text) {
    return (text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^[ ]*>(?!=)[ ]?/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1'));
}
function verbalize(text, lang) {
    let spoken = text.replace(/#(?=\d)/g, ' number ');
    for (const [symbol, code] of CURRENCY_CODES) {
        spoken = spoken.replace(amountAfter(symbol), (_match, amount) => {
            return ` ${amount} ${currencyName(code, lang, { singular: amount === '1' })} `;
        });
        spoken = spoken.split(symbol).join(` ${currencyName(code, lang)} `);
    }
    for (const [symbol, spokenForm] of SPEECH_LEXICON[lang]) {
        spoken = spoken.split(symbol).join(spokenForm);
    }
    return spoken;
}
function amountAfter(symbol) {
    return new RegExp(`${escapeRegExp(symbol)}\\s?(\\d[\\d.,]*)`, 'g');
}
function escapeRegExp(text) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
function currencyName(code, lang, { singular = false } = {}) {
    const key = `${lang}:${code}:${singular}`;
    const hit = CURRENCY_NAMES.get(key);
    if (hit !== undefined) {
        return hit;
    }
    const parts = new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'name',
        maximumFractionDigits: 0
    }).formatToParts(singular ? 1 : 2);
    const name = parts.find((part) => part.type === 'currency')?.value ?? code;
    CURRENCY_NAMES.set(key, name);
    return name;
}
const CURRENCY_NAMES = new Map();
function filterUnspeakable(text, unspeakable) {
    const dropped = [];
    const kept = text.replace(unspeakable, (char) => {
        dropped.push(char);
        return '';
    });
    return {
        text: kept
            .replace(/ +/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim(),
        dropped
    };
}
