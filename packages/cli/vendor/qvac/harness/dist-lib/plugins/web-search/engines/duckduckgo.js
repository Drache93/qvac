import { fetchHtml } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
import { urlMatchesHost } from '../url-helpers.js';
function extractDdgUrl(raw) {
    if (raw.includes('uddg=')) {
        const m = raw.match(/uddg=([^&]+)/);
        if (m?.[1]) {
            return decodeURIComponent(m[1]);
        }
    }
    return raw;
}
function isOrganicUrl(url) {
    return url.startsWith('http') && !urlMatchesHost(url, 'duckduckgo.com');
}
function parseLinksMain(html) {
    const results = [];
    const pat = /<div[^>]*class="[^"]*links_main[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(pat)) {
        const url = extractDdgUrl(m[1] || '');
        const title = clean(m[2] || '');
        const content = clean(m[3] || '');
        if (url && title && isOrganicUrl(url)) {
            results.push({ title, url, content: content || title, position: results.length + 1 });
        }
    }
    return results;
}
function extractLinks(html) {
    const linkPat = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const links = [];
    for (const lm of html.matchAll(linkPat)) {
        const url = extractDdgUrl(lm[1] || '');
        const title = clean(lm[2] || '');
        if (url && title && isOrganicUrl(url)) {
            links.push({ url, title });
        }
    }
    return links;
}
function extractSnippets(html) {
    const snipPat = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippets = [];
    for (const sm of html.matchAll(snipPat)) {
        const s = clean(sm[1] || '');
        if (s) {
            snippets.push(s);
        }
    }
    return snippets;
}
function parseResultLinks(html) {
    const links = extractLinks(html);
    const snippets = extractSnippets(html);
    const results = [];
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        if (!link) {
            continue;
        }
        results.push({
            title: link.title,
            url: link.url,
            content: snippets[i] || link.title,
            position: results.length + 1
        });
    }
    return results;
}
function parseUddgFallback(html) {
    const results = [];
    const uddgPat = /uddg=([^&"]+)/gi;
    const seen = new Set();
    for (const um of html.matchAll(uddgPat)) {
        try {
            const url = decodeURIComponent(um[1] || '');
            if (url.startsWith('http') && !seen.has(url) && !urlMatchesHost(url, 'duckduckgo.com')) {
                seen.add(url);
                const host = new URL(url).hostname;
                results.push({
                    title: host,
                    url,
                    content: `Result from ${host}`,
                    position: results.length + 1,
                    weak: true
                });
            }
        }
        catch { }
    }
    return results;
}
export function duckDuckGoUrl() {
    return 'https://html.duckduckgo.com/html/';
}
export async function searchDuckDuckGo(query, fetcher, signal) {
    const body = `q=${encodeURIComponent(query)}`;
    const html = await fetchHtml(fetcher, duckDuckGoUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://html.duckduckgo.com/'
        },
        body,
        signal
    });
    const primary = parseLinksMain(html);
    if (primary.length > 0) {
        return primary;
    }
    const secondary = parseResultLinks(html);
    if (secondary.length > 0) {
        return secondary;
    }
    return parseUddgFallback(html);
}
