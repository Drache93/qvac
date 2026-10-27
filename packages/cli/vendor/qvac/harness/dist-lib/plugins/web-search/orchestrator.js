import { DEFAULT_MAX_RESULTS, ENGINES } from './engine-registry.js';
import { TimeoutError } from './fetch-html.js';
import { mergeResults } from './merge-results.js';
export function classifyEngineError(reason) {
    return reason instanceof TimeoutError ? 'timeout' : 'error';
}
function processSettledResult(engineName, result, { outcomes, engineSummary }) {
    if (result.status === 'fulfilled') {
        outcomes.push(result.value);
        engineSummary.push({
            engine: engineName,
            status: 'ok',
            resultCount: result.value.results.length,
            durationMs: result.value.durationMs
        });
    }
    else {
        engineSummary.push({
            engine: engineName,
            status: classifyEngineError(result.reason),
            resultCount: 0,
            durationMs: 0
        });
    }
}
export async function searchWeb(fetcher, query, { engines = ENGINES, maxResults = DEFAULT_MAX_RESULTS, signal } = {}) {
    const settled = await Promise.allSettled(engines.map(async ({ name, search }) => {
        const start = Date.now();
        const results = await search(query, fetcher, signal);
        return {
            engine: name,
            results: [...results],
            durationMs: Date.now() - start
        };
    }));
    const outcomes = [];
    const engineSummary = [];
    for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];
        const settledResult = settled[i];
        if (!engine || !settledResult) {
            continue;
        }
        processSettledResult(engine.name, settledResult, { outcomes, engineSummary });
    }
    if (outcomes.length === 0) {
        return { results: [], engineSummary };
    }
    return { results: mergeResults(outcomes, maxResults), engineSummary };
}
