import { type BareLookupAll } from './validating-lookup.ts';
import { type NoRedirectFetchInit, type NoRedirectFetchResponse } from './no-redirect-fetch-impl.ts';
export type { NoRedirectFetchResponse };
export interface ConnectionAgent {
    createConnection(opts: {
        readonly host?: string;
    }): unknown;
}
export type AgentCtor<A extends ConnectionAgent> = new (opts: object) => A;
export declare class BlockedHostError extends Error {
    readonly code = "EBLOCKEDHOST";
    constructor(host: string);
}
export declare function makeValidatingAgent<A extends ConnectionAgent>(Agent: AgentCtor<A>, lookup: BareLookupAll): A;
export declare function noRedirectFetch(url: URL, init?: NoRedirectFetchInit): Promise<NoRedirectFetchResponse>;
