export type NamedMarkupTag = 'function' | 'parameter';
export declare const MAX_MARKUP_NAME_LENGTH = 64;
export interface NamedMarkupBlock {
    readonly name: string;
    readonly body: string;
    readonly start: number;
    readonly end: number;
    readonly nested: boolean;
}
export interface NamedMarkupToken {
    readonly kind: 'open' | 'close';
    readonly start: number;
    readonly end: number;
    readonly name?: string;
}
export interface NamedMarkupScan {
    readonly token: NamedMarkupToken | null;
    readonly partial: number;
}
export interface ScanNamedMarkupOptions {
    readonly from?: number;
    readonly maxNameLength?: number;
    readonly haystack?: string;
}
export declare function scanNamedMarkup(text: string, tag: NamedMarkupTag, { from, maxNameLength, haystack }?: ScanNamedMarkupOptions): NamedMarkupScan;
export declare function namedMarkupBlocks(text: string, tag: NamedMarkupTag, maxNameLength?: number): Generator<NamedMarkupBlock>;
