import { normalizeUrl } from './url-normalize.js';
const WEAK_RESULT_PENALTY = 0.2;
function scoreFor(r) {
    const base = 1 / r.position;
    return r.weak ? base * WEAK_RESULT_PENALTY : base;
}
function updateEntry(existing, r, engine) {
    if (r.title.length > existing.title.length) {
        existing.title = r.title;
    }
    if (r.content.length > existing.content.length) {
        existing.content = r.content;
    }
    existing.score += scoreFor(r);
    existing.engines.add(engine);
}
export function mergeResults(engineResults, maxResults) {
    const map = new Map();
    for (const { engine, results } of engineResults) {
        for (const r of results) {
            const key = normalizeUrl(r.url);
            const existing = map.get(key);
            if (existing) {
                updateEntry(existing, r, engine);
            }
            else {
                map.set(key, {
                    title: r.title,
                    url: r.url,
                    content: r.content,
                    score: scoreFor(r),
                    engines: new Set([engine])
                });
            }
        }
    }
    const sorted = Array.from(map.values()).sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (b.engines.size !== a.engines.size) {
            return b.engines.size - a.engines.size;
        }
        return b.content.length - a.content.length;
    });
    return sorted.slice(0, maxResults).map((entry) => ({
        title: entry.title,
        url: entry.url,
        content: entry.content,
        score: Math.round(entry.score * 100) / 100,
        engines: Array.from(entry.engines)
    }));
}
