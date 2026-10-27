import { fetchJson } from '../fetch-html.js';
import { clean } from '../../../lib/helpers/html-helpers.js';
function extractSearchItems(data) {
    if (typeof data !== 'object' || data === null) {
        return [];
    }
    const query = 'query' in data ? data.query : undefined;
    if (typeof query !== 'object' || query === null) {
        return [];
    }
    const search = 'search' in query ? query.search : undefined;
    if (!Array.isArray(search)) {
        return [];
    }
    const items = [];
    for (const entry of search) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const title = 'title' in entry ? entry.title : undefined;
        const snippet = 'snippet' in entry ? entry.snippet : undefined;
        if (typeof title === 'string' && typeof snippet === 'string') {
            items.push({ title, snippet });
        }
    }
    return items;
}
export function wikipediaUrl(query) {
    return `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&utf8=1`;
}
export async function searchWikipedia(query, fetcher, signal) {
    const data = await fetchJson(fetcher, wikipediaUrl(query), { signal });
    const items = extractSearchItems(data);
    return items.map((item, idx) => ({
        title: item.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        content: clean(item.snippet || item.title),
        position: idx + 1
    }));
}
