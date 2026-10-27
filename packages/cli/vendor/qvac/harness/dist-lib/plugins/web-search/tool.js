import { errorMessage } from '../../lib/guards.js';
import { formatResultsForPrompt } from './format-results.js';
import { searchWeb } from './orchestrator.js';
const SMALL_CONTEXT_TOKENS = 12_288;
const SMALL_CONTEXT_RESULTS = 8;
const LARGE_CONTEXT_RESULTS = 12;
function resultBudget(ctxSize) {
    return ctxSize && ctxSize <= SMALL_CONTEXT_TOKENS ? SMALL_CONTEXT_RESULTS : LARGE_CONTEXT_RESULTS;
}
export function createWebSearchTool(engines, maxResults) {
    return {
        name: 'web_search',
        toolset: 'web-search',
        description: 'Search the web for current information using multiple search engines. ' +
            'Returns a concise aggregated and ranked result set. Use this when the user asks about ' +
            'recent events, current information, or anything that may require ' +
            'up-to-date knowledge beyond your training data. When a snippet is not enough to answer, ' +
            'read the full page behind a result with web_fetch.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
        },
        effect: () => 'read',
        egress: (args) => {
            const query = args.query;
            return typeof query === 'string' && query.trim().length > 0
                ? engines.map((engine) => engine.url(query))
                : null;
        },
        stableRead: true,
        async execute(args, ctx) {
            const query = args.query;
            if (typeof query !== 'string' || query.trim().length === 0) {
                return { error: 'query must be a non-empty string' };
            }
            if (!ctx?.fetch) {
                return { error: 'web_search has no network access' };
            }
            try {
                const { results, engineSummary } = await searchWeb(ctx.fetch, query, {
                    engines,
                    maxResults: maxResults ?? resultBudget(ctx.ctxSize),
                    signal: ctx.signal
                });
                if (ctx.signal?.aborted) {
                    return { error: 'web_search cancelled' };
                }
                if (results.length > 0) {
                    return { content: formatResultsForPrompt(results), data: { results } };
                }
                const failed = engineSummary.filter((e) => e.status !== 'ok').length;
                if (engineSummary.length > 0 && failed === engineSummary.length) {
                    return {
                        error: `web_search unavailable: all ${failed} engines failed (timeout/error)`,
                        code: 'transport'
                    };
                }
                return { content: `No web results found for "${query}".` };
            }
            catch (err) {
                return { error: errorMessage(err), code: 'transport' };
            }
        }
    };
}
