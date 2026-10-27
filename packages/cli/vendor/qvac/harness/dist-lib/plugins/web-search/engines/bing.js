import { HarnessError } from '../../../lib/errors.js';
import { fetchHtml } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
import { urlMatchesHost } from '../url-helpers.js';
import { SAFARI_UA } from '../../../lib/helpers/user-agents.js';
function isOrganicBingUrl(url) {
    return url.startsWith('http') && !urlMatchesHost(url, 'bing.com') && !url.includes('msockid=');
}
function tryBase64Decode(encoded) {
    try {
        const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
        const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
        return decoded.startsWith('http') ? decoded : null;
    }
    catch {
        return null;
    }
}
function extractCiteUrl(blockHtml) {
    const citeMatch = blockHtml.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
    if (!citeMatch) {
        return null;
    }
    const citeText = clean(citeMatch[1] || '')
        .replace(/\s*›\s*/g, '/')
        .replace(/\s+/g, '');
    return citeText.startsWith('http') ? citeText : `https://${citeText}`;
}
function decodeBingRedirect(rawUrl, blockHtml) {
    const uMatch = rawUrl.replace(/&amp;/g, '&').match(/[&?]u=a1([^&]+)/);
    if (uMatch?.[1]) {
        const decoded = tryBase64Decode(uMatch[1]);
        if (decoded) {
            return decoded;
        }
    }
    if (!rawUrl.startsWith('http') && blockHtml) {
        return extractCiteUrl(blockHtml) ?? rawUrl;
    }
    return rawUrl;
}
function parseBAlgoBlock(inner) {
    const linkMatch = inner.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    if (!linkMatch) {
        return null;
    }
    let rawUrl = linkMatch[1] || '';
    const title = clean(linkMatch[2] || '');
    if (!title || title.length < 3) {
        return null;
    }
    rawUrl = decodeBingRedirect(rawUrl, inner);
    if (!isOrganicBingUrl(rawUrl)) {
        return null;
    }
    const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const content = snippetMatch ? clean(snippetMatch[1] || '') : title;
    return { title, url: rawUrl, content, position: 0 };
}
function parseBAlgoBlocks(html) {
    const results = [];
    const blocks = html.split(/class="b_algo"/i);
    for (let i = 1; i < blocks.length; i++) {
        const inner = blocks[i]?.slice(0, 5000) || '';
        const parsed = parseBAlgoBlock(inner);
        if (parsed) {
            results.push({ ...parsed, position: results.length + 1 });
        }
    }
    return results;
}
function parseH2Match(hm) {
    let rawUrl = hm[1] || '';
    const title = clean(hm[2] || '');
    if (!title || title.length < 3) {
        return null;
    }
    rawUrl = decodeBingRedirect(rawUrl, '');
    if (!isOrganicBingUrl(rawUrl)) {
        return null;
    }
    return { title, url: rawUrl, content: title, position: 0 };
}
function parseH2Fallback(html) {
    const results = [];
    const h2Pat = /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi;
    const seen = new Set();
    for (const hm of html.matchAll(h2Pat)) {
        const parsed = parseH2Match(hm);
        if (!parsed || seen.has(parsed.url)) {
            continue;
        }
        seen.add(parsed.url);
        results.push({ ...parsed, position: results.length + 1 });
        if (results.length >= 15) {
            break;
        }
    }
    return results;
}
export function bingUrl(query) {
    return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}
export async function searchBing(query, fetcher, signal) {
    const html = await fetchHtml(fetcher, bingUrl(query), {
        headers: { 'User-Agent': SAFARI_UA },
        signal
    });
    if (html.includes('captcha') || html.includes('challenge/verify') || html.includes('Turnstile')) {
        throw new HarnessError('SEARCH_CAPTCHA', ['Bing']);
    }
    const primary = parseBAlgoBlocks(html);
    if (primary.length > 0) {
        return primary;
    }
    return parseH2Fallback(html);
}
