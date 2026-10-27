import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { Fetcher, RankedResult } from '../types.ts';
export declare function yahooUrl(query: string): string;
export declare function searchYahoo(query: string, fetcher: Fetcher, signal?: BareAbortSignal): Promise<ReadonlyArray<RankedResult>>;
