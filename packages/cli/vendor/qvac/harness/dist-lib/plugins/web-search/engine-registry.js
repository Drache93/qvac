import { aolUrl, searchAol } from './engines/aol.js';
import { bingUrl, searchBing } from './engines/bing.js';
import { braveUrl, searchBrave } from './engines/brave.js';
import { duckDuckGoUrl, searchDuckDuckGo } from './engines/duckduckgo.js';
import { googleUrl, searchGoogle } from './engines/google.js';
import { searchWikipedia, wikipediaUrl } from './engines/wikipedia.js';
import { searchYahoo, yahooUrl } from './engines/yahoo.js';
export const DEFAULT_MAX_RESULTS = 8;
export const ENGINES = [
    { name: 'duckduckgo', url: duckDuckGoUrl, search: searchDuckDuckGo },
    { name: 'brave', url: braveUrl, search: searchBrave },
    { name: 'google', url: googleUrl, search: searchGoogle },
    { name: 'yahoo', url: yahooUrl, search: searchYahoo },
    { name: 'aol', url: aolUrl, search: searchAol },
    { name: 'bing', url: bingUrl, search: searchBing },
    { name: 'wikipedia', url: wikipediaUrl, search: searchWikipedia }
];
