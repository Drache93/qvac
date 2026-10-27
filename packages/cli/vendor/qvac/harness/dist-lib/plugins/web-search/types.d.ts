import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export interface RankedResult {
    title: string;
    url: string;
    content: string;
    position: number;
    weak?: boolean;
}
export interface WebSearchResult {
    title: string;
    url: string;
    content: string;
    score?: number;
    engines?: string[];
}
export interface EngineOutcome {
    engine: string;
    results: RankedResult[];
    durationMs: number;
}
export interface FetchInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: 'follow' | 'manual' | 'error';
    signal?: BareAbortSignal;
}
export interface Response {
    ok: boolean;
    status: number;
    text(): Promise<string>;
}
export type Fetcher = (url: string, init?: FetchInit) => Promise<Response>;
export type SearchEngine = (query: string, fetcher: Fetcher, signal?: BareAbortSignal) => Promise<ReadonlyArray<RankedResult>>;
