import { decodeHtmlEntities, stripHtmlTags } from '../helpers/html-helpers.js';
const NOISE_BLOCKS = [
    'script',
    'style',
    'noscript',
    'template',
    'svg',
    'iframe',
    'head',
    'header',
    'nav',
    'footer',
    'aside'
];
const NOISE_ROLES = /<(\w+)[^>]*\brole=["'](?:navigation|banner|contentinfo|complementary|search)["'][^>]*>[\s\S]*?<\/\1>/gi;
const BLOCK_END_TAGS = /<\/(?:p|div|li|section|article|main|tr|h[1-6]|blockquote|pre|ul|ol|table|figcaption|dd|dt)>/gi;
export function looksLikeHtml(body) {
    return (/^\s*(?:<!doctype\s|<html[\s>]|<head[\s>]|<body[\s>])/i.test(body) ||
        /<\w+[^>]*>[\s\S]*<\/\w+>/.test(body.slice(0, 2000)));
}
export function extractPageText(html) {
    const title = extractTitle(html);
    const text = collapseLines(stripHtmlTags(toLineBreaks(stripNoise(pickMainRegion(html)))));
    return { title, text: decodeHtmlEntities(text) };
}
function extractTitle(html) {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!match?.[1]) {
        return null;
    }
    const title = decodeHtmlEntities(stripHtmlTags(match[1])).replace(/\s+/g, ' ').trim();
    return title.length > 0 ? title : null;
}
function pickMainRegion(html) {
    for (const tag of ['main', 'article']) {
        const match = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, 'i').exec(html);
        if (match) {
            return match[0];
        }
    }
    return html;
}
function stripNoise(html) {
    let out = html;
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/<!--[\s\S]*?-->/g, '');
    }
    for (const tag of NOISE_BLOCKS) {
        out = out.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, 'gi'), ' ');
    }
    return out.replace(NOISE_ROLES, ' ');
}
function toLineBreaks(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(BLOCK_END_TAGS, '\n');
}
function collapseLines(text) {
    return text
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 0)
        .join('\n');
}
