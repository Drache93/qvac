import { decodeHtmlEntities } from '../helpers/html-helpers.js';
const META_TAG = /<meta\s[^>]*>/gi;
const VIDEO_ATTR = /(?:property|name)=["']og:video(?::secure_url|:url)?["']/i;
const META_CONTENT = /content=["']([^"']+)["']/i;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'youtu.be']);
export function pageVideoRef(html, pageUrl) {
    for (const match of html.matchAll(META_TAG)) {
        const tag = match[0];
        if (!VIDEO_ATTR.test(tag)) {
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
        return classify(resolved);
    }
    return null;
}
function classify(url) {
    const host = url.hostname.replace(/^www\./, '');
    if (YOUTUBE_HOSTS.has(host)) {
        return { provider: 'youtube', url: watchUrl(url) };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        return { provider: 'vimeo', url: url.toString() };
    }
    return { provider: host, url: url.toString() };
}
function watchUrl(url) {
    const embed = /^\/embed\/([\w-]+)/.exec(url.pathname);
    if (!embed) {
        return url.toString();
    }
    return `https://www.youtube.com/watch?v=${embed[1]}`;
}
