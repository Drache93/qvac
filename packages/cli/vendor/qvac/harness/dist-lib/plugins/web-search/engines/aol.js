import { fetchHtml } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
import { urlMatchesHost } from '../url-helpers.js';
function decodeRuUrl(encoded) {
    try {
        const href = decodeURIComponent(encoded);
        if (!href.startsWith('http')) {
            return null;
        }
        if (urlMatchesHost(href, 'search.aol.com') || urlMatchesHost(href, 'shopping.yahoo.com')) {
            return null;
        }
        return href;
    }
    catch {
        return null;
    }
}
function parseAlgoBlock(inner) {
    const ruMatch = inner.match(/\/RU=(https?%3a%2f%2f[^/]*?)\/RK/i);
    if (!ruMatch) {
        return null;
    }
    const href = decodeRuUrl(ruMatch[1] || '');
    if (!href) {
        return null;
    }
    const titleMatch = inner.match(/<a[^>]*class="[^"]*fz-[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? clean(titleMatch[1] || '') : '';
    if (!title) {
        return null;
    }
    const snippetMatch = inner.match(/class="compText[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    const content = snippetMatch ? clean(snippetMatch[1] || '') : title;
    return { title, url: href, content, position: 0 };
}
function parseAlgoBlocks(html) {
    const results = [];
    const blocks = html.split(/algo algo-sr/i);
    for (let i = 1; i < blocks.length; i++) {
        const inner = blocks[i]?.slice(0, 5000) || '';
        const parsed = parseAlgoBlock(inner);
        if (parsed) {
            results.push({ ...parsed, position: results.length + 1 });
        }
    }
    return results;
}
function parseRuFallback(html) {
    const results = [];
    const seen = new Set();
    const ruGlobal = /\/RU=(https?%3a%2f%2f[^/]*?)\/RK/gi;
    for (const rm of html.matchAll(ruGlobal)) {
        const href = decodeRuUrl(rm[1] || '');
        if (!href || seen.has(href)) {
            continue;
        }
        seen.add(href);
        const host = new URL(href).hostname;
        results.push({
            title: host,
            url: href,
            content: `Result from ${host}`,
            position: results.length + 1,
            weak: true
        });
        if (results.length >= 15) {
            break;
        }
    }
    return results;
}
export function aolUrl(query) {
    return `https://search.aol.com/aol/search?q=${encodeURIComponent(query)}`;
}
export async function searchAol(query, fetcher, signal) {
    const html = await fetchHtml(fetcher, aolUrl(query), { signal });
    const primary = parseAlgoBlocks(html);
    if (primary.length > 0) {
        return primary;
    }
    return parseRuFallback(html);
}
