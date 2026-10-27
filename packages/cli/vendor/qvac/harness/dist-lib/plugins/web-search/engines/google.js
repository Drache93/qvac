import { HarnessError } from '../../../lib/errors.js';
import { fetchHtml } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
import { urlMatchesHost } from '../url-helpers.js';
import { GOOGLE_GSA_UA } from '../../../lib/helpers/user-agents.js';
function resolveGoogleUrl(rawUrl) {
    if (rawUrl.startsWith('/url?q=')) {
        return decodeURIComponent(rawUrl.slice(7).split('&')[0] || '');
    }
    return rawUrl;
}
function isGoogleSearchSelfLink(url) {
    try {
        const u = new URL(url);
        const h = u.hostname.toLowerCase();
        return (h === 'google.com' || h === 'www.google.com') && u.pathname === '/search';
    }
    catch {
        return false;
    }
}
function isSkippableUrl(url) {
    return isGoogleSearchSelfLink(url) || urlMatchesHost(url, 'accounts.google.com');
}
function extractTitle(anchorBody) {
    const titleMatch = anchorBody.match(/<(?:div|h3)[^>]*>([\s\S]*?)<\/(?:div|h3)>/i);
    return titleMatch ? clean(titleMatch[1] || '') : clean(anchorBody);
}
function parseAnchor(am, { html, snippetPat, existing }) {
    const rawUrl = resolveGoogleUrl(am[1] || '');
    if (isSkippableUrl(rawUrl) || !rawUrl.startsWith('http')) {
        return null;
    }
    const title = extractTitle(am[2] || '');
    if (!title || title.length < 3 || existing.some((r) => r.url === rawUrl)) {
        return null;
    }
    const region = html.slice(am.index, (am.index ?? 0) + 3000);
    snippetPat.lastIndex = 0;
    const sm = snippetPat.exec(region);
    const content = sm ? clean(sm[1] || '') : '';
    return { title, url: rawUrl, content, position: 0 };
}
function parseDataVedAnchors(html) {
    const results = [];
    const snippetPat = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const anchorPat = /<a[^>]*\shref="(\/url\?q=[^"]+|https?:\/\/[^"]+)"[^>]*data-ved="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const am of html.matchAll(anchorPat)) {
        const parsed = parseAnchor(am, { html, snippetPat, existing: results });
        if (parsed) {
            results.push({ ...parsed, position: results.length + 1 });
        }
    }
    return results;
}
function parseH3Match(hm, existing) {
    let rawUrl = hm[2] || '';
    const title = clean(hm[1] || '');
    if (!title || title.length < 3) {
        return null;
    }
    rawUrl = resolveGoogleUrl(rawUrl);
    if (!rawUrl.startsWith('http')) {
        return null;
    }
    if (existing.some((r) => r.url === rawUrl)) {
        return null;
    }
    return { title, url: rawUrl, content: '', position: 0 };
}
function parseH3Fallback(html) {
    const results = [];
    const h3Pat = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<a[^>]*href="(\/url\?q=[^"]+|https?:\/\/(?!google\.com)[^"]+)"[^>]*>/gi;
    for (const hm of html.matchAll(h3Pat)) {
        const parsed = parseH3Match(hm, results);
        if (parsed) {
            results.push({ ...parsed, position: results.length + 1 });
        }
    }
    return results;
}
export function googleUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&ie=utf8&oe=utf8&filter=0`;
}
export async function searchGoogle(query, fetcher, signal) {
    const html = await fetchHtml(fetcher, googleUrl(query), {
        headers: { 'User-Agent': GOOGLE_GSA_UA, Accept: '*/*' },
        cookies: { CONSENT: 'YES+' },
        signal
    });
    if (html.includes('detected unusual traffic') || html.includes('g-recaptcha')) {
        throw new HarnessError('SEARCH_CAPTCHA', ['Google']);
    }
    const primary = parseDataVedAnchors(html);
    if (primary.length > 0) {
        return primary;
    }
    return parseH3Fallback(html);
}
