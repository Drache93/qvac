export type IPFamily = 4 | 6;
export interface LookupAddress {
    readonly address: string;
    readonly family: IPFamily;
}
export type LookupAllCb = (err: Error | null, addresses: ReadonlyArray<LookupAddress> | null) => void;
export interface BareLookupAllOpts {
    readonly all: true;
    readonly family?: IPFamily | 0;
    readonly hints?: number;
}
export type BareLookupAll = (hostname: string, opts: BareLookupAllOpts, cb: LookupAllCb) => void;
export declare class BlockedAddressError extends Error {
    readonly code = "EBLOCKEDADDR";
    constructor(hostname: string, address: string);
}
export declare function makeValidatingLookup(rawLookup: BareLookupAll): BareLookupAll;
