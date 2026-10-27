export function stripHtmlTags(text) {
    let out = text;
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/<[^>]*>/g, '');
    }
    return out;
}
const NAMED_ENTITIES = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&nbsp;': ' ',
    '&amp;': '&'
};
export function decodeHtmlEntities(text) {
    return text.replace(/&(?:lt|gt|quot|nbsp|amp|#\d+);/g, (match) => match.startsWith('&#')
        ? String.fromCodePoint(parseInt(match.slice(2, -1), 10))
        : (NAMED_ENTITIES[match] ?? match));
}
export function clean(raw) {
    return decodeHtmlEntities(stripHtmlTags(raw)).trim();
}
