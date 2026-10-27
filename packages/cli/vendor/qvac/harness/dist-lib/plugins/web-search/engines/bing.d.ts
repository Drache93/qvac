import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { Fetcher, RankedResult } from '../types.ts';
export declare function bingUrl(query: string): string;
export declare function searchBing(query: string, fetcher: Fetcher, signal?: BareAbortSignal): Promise<ReadonlyArray<RankedResult>>;
