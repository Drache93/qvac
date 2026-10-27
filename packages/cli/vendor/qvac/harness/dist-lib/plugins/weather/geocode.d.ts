import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolFetch } from '../../lib/contract/index.ts';
import { type ResolvedPlace } from './place.ts';
export declare const GEOCODER_HOST = "geocoding-api.open-meteo.com";
export declare const GEOCODE_TIMEOUT_MS = 5000;
export interface Candidate extends ResolvedPlace {
    readonly latitude: number;
    readonly longitude: number;
    readonly population: number | undefined;
}
export interface Chosen {
    readonly place: Candidate;
    readonly verified: boolean;
}
export type Choice = Chosen | {
    readonly contenders: readonly Candidate[];
};
export interface GeocodeRequest {
    readonly fetch: ToolFetch;
    readonly signal: BareAbortSignal;
    readonly timeoutMs: number;
}
export declare function geocode(city: string, lookup: GeocodeRequest): Promise<Candidate[]>;
export declare function geocoderUrl(city: string): URL;
export declare function choose(city: string, qualifier: string | null, candidates: readonly Candidate[]): Choice | null;
