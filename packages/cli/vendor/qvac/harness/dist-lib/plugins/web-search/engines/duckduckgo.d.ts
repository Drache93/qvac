import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { Fetcher, RankedResult } from '../types.ts';
export declare function duckDuckGoUrl(): string;
export declare function searchDuckDuckGo(query: string, fetcher: Fetcher, signal?: BareAbortSignal): Promise<ReadonlyArray<RankedResult>>;
