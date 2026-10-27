import { fetchHtml } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
function parseSnippetBlock(inner) {
    const urlMatch = inner.match(/<a[^>]*href="(https?:\/\/(?!imgs\.search\.brave)[^"]*)"[^>]*>/i);
    if (!urlMatch) {
        return null;
    }
    const href = urlMatch[1] || '';
    if (!href) {
        return null;
    }
    const titleMatch = inner.match(/<div[^>]*class="[^"]*title[^"]*search-snippet-title[^"]*"[^>]*(?:title="([^"]*)"[^>]*)?>([^<]*)<\/div>/i);
    const title = titleMatch ? clean(titleMatch[1] || titleMatch[2] || '') : '';
    if (!title) {
        return null;
    }
    const contentMatch = inner.match(/<div[^>]*class="[^"]*generic-snippet[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const content = contentMatch ? clean(contentMatch[1] || '') : title;
    return { title, url: href, content, position: 0 };
}
function parseSnippetBlocks(html) {
    const results = [];
    const blocks = html.split(/<div[^>]*class="snippet\s[^"]*"[^>]*data-type="web"[^>]*>/i);
    for (let i = 1; i < blocks.length; i++) {
        const inner = blocks[i] || '';
        const parsed = parseSnippetBlock(inner);
        if (parsed) {
            results.push({ ...parsed, position: results.length + 1 });
        }
    }
    return results;
}
function parseLinkFallback(html) {
    const results = [];
    const seen = new Set();
    const linkPat = /<a[^>]*href="(https?:\/\/(?!search\.brave\.com|imgs\.search\.brave|brave\.com)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const lm of html.matchAll(linkPat)) {
        const href = lm[1] || '';
        const text = clean(lm[2] || '');
        if (!href.startsWith('http') || text.length < 5 || seen.has(href)) {
            continue;
        }
        seen.add(href);
        results.push({ title: text, url: href, content: text, position: results.length + 1 });
        if (results.length >= 15) {
            break;
        }
    }
    return results;
}
export function braveUrl(query) {
    return `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
}
export async function searchBrave(query, fetcher, signal) {
    const html = await fetchHtml(fetcher, braveUrl(query), {
        cookies: { safesearch: 'off', useLocation: '0', summarizer: '0', country: 'us' },
        signal
    });
    const primary = parseSnippetBlocks(html);
    if (primary.length > 0) {
        return primary;
    }
    return parseLinkFallback(html);
}
