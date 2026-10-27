import type { WebSearchResult } from './types.ts';
export declare const MAX_CONTENT_CHARS = 800;
export declare function formatResultsForPrompt(results: ReadonlyArray<WebSearchResult>): string;
