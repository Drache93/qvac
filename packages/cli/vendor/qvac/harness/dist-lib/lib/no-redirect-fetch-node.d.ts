import * as http from 'node:http';
import { type NoRedirectFetchInit, type NoRedirectFetchResponse } from './no-redirect-fetch-impl.ts';
export declare function noRedirectFetch(url: URL, init?: NoRedirectFetchInit): Promise<NoRedirectFetchResponse>;
export declare function createLookup(validatedAddresses: readonly string[] | undefined): NonNullable<http.RequestOptions['lookup']>;
