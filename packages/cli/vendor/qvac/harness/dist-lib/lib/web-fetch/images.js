import { decodeHtmlEntities } from '../helpers/html-helpers.js';
const META_TAG = /<meta\s[^>]*>/gi;
const IMAGE_ATTR = /(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image)["']/i;
const META_CONTENT = /content=["']([^"']+)["']/i;
export const MAX_PAGE_IMAGES = 2;
export function pageImageUrls(html, pageUrl) {
    const out = [];
    for (const match of html.matchAll(META_TAG)) {
        if (out.length >= MAX_PAGE_IMAGES)
            break;
        const tag = match[0];
        if (!IMAGE_ATTR.test(tag)) {
            continue;
        }
        const content = META_CONTENT.exec(tag)?.[1];
        if (!content) {
            continue;
        }
        let resolved;
        try {
            resolved = new URL(decodeHtmlEntities(content).trim(), pageUrl);
        }
        catch {
            continue;
        }
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
            continue;
        }
        const href = resolved.toString();
        if (!out.some((seen) => seen.replace(/^https?:/, '') === href.replace(/^https?:/, ''))) {
            out.push(href);
        }
    }
    return out;
}
export function imageFileName(url, mimeType) {
    let last = url.pathname.split('/').filter(Boolean).pop() ?? '';
    try {
        last = decodeURIComponent(last);
    }
    catch { }
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(last)) {
        return last;
    }
    const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'img';
    return `${url.hostname}.${ext}`;
}
