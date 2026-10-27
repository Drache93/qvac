import type { EngineOutcome, WebSearchResult } from './types.ts';
export declare function mergeResults(engineResults: ReadonlyArray<EngineOutcome>, maxResults: number): ReadonlyArray<WebSearchResult>;
