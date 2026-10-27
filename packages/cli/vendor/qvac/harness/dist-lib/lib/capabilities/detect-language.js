import { requirePeers } from '../helpers/require-peers.js';
import { retryMemo } from '../helpers/retry-memo.js';
export const UNDETERMINED = 'und';
const langdetect = retryMemo(() => {
    requirePeers('@qvac/harness language detection', {
        '@qvac/langdetect-text': () => import.meta.resolve('@qvac/langdetect-text')
    });
    return import('@qvac/langdetect-text');
});
export async function detectLanguage({ text, topK }) {
    const { detectMultiple, detectOne } = await langdetect();
    if (!topK || topK === 1) {
        const { code, language } = detectOne(text);
        return [{ code, language }];
    }
    return detectMultiple(text, topK).map(({ code, language, probability }) => ({
        code,
        language,
        probability
    }));
}
export async function languageName(code) {
    const { getLangName } = await langdetect();
    return getLangName(code);
}
