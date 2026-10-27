import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type EngineEntry } from './engine-registry.ts';
import type { Fetcher, WebSearchResult } from './types.ts';
export interface EngineSummaryEntry {
    readonly engine: string;
    readonly status: 'ok' | 'timeout' | 'error';
    readonly resultCount: number;
    readonly durationMs: number;
}
export interface SearchWebResult {
    readonly results: ReadonlyArray<WebSearchResult>;
    readonly engineSummary: ReadonlyArray<EngineSummaryEntry>;
}
export declare function classifyEngineError(reason: unknown): 'timeout' | 'error';
export interface SearchWebOptions {
    readonly engines?: readonly EngineEntry[];
    readonly maxResults?: number;
    readonly signal?: BareAbortSignal;
}
export declare function searchWeb(fetcher: Fetcher, query: string, { engines, maxResults, signal }?: SearchWebOptions): Promise<SearchWebResult>;
