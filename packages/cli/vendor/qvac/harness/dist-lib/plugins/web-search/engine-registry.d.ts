import type { SearchEngine } from './types.ts';
import { aolUrl, searchAol } from './engines/aol.ts';
import { bingUrl, searchBing } from './engines/bing.ts';
import { braveUrl, searchBrave } from './engines/brave.ts';
import { duckDuckGoUrl, searchDuckDuckGo } from './engines/duckduckgo.ts';
import { googleUrl, searchGoogle } from './engines/google.ts';
import { searchWikipedia, wikipediaUrl } from './engines/wikipedia.ts';
import { searchYahoo, yahooUrl } from './engines/yahoo.ts';
export interface EngineEntry {
    readonly name: string;
    readonly url: (query: string) => string;
    readonly search: SearchEngine;
}
export declare const DEFAULT_MAX_RESULTS = 8;
export declare const ENGINES: readonly [{
    readonly name: 'duckduckgo';
    readonly url: typeof duckDuckGoUrl;
    readonly search: typeof searchDuckDuckGo;
}, {
    readonly name: 'brave';
    readonly url: typeof braveUrl;
    readonly search: typeof searchBrave;
}, {
    readonly name: 'google';
    readonly url: typeof googleUrl;
    readonly search: typeof searchGoogle;
}, {
    readonly name: 'yahoo';
    readonly url: typeof yahooUrl;
    readonly search: typeof searchYahoo;
}, {
    readonly name: 'aol';
    readonly url: typeof aolUrl;
    readonly search: typeof searchAol;
}, {
    readonly name: 'bing';
    readonly url: typeof bingUrl;
    readonly search: typeof searchBing;
}, {
    readonly name: 'wikipedia';
    readonly url: typeof wikipediaUrl;
    readonly search: typeof searchWikipedia;
}];
export type EngineName = (typeof ENGINES)[number]['name'];
